package web

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/labstack/echo/v4"
	"github.com/tossp/opencode-session-share/internal/share"
)

func testEcho(t *testing.T) http.Handler {
	return testEchoWithConfig(t, Config{})
}

func testEchoWithConfig(t *testing.T, config Config) http.Handler {
	t.Helper()
	store, err := share.OpenStore(filepath.Join(t.TempDir(), "share.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })
	assets := fstest.MapFS{
		"templates/share.html": {Data: []byte(`<!doctype html><html><head><script>window.SHARE_ID = "{{share_id}}";</script><script type="module" src="/static/share.js"></script><link rel="stylesheet" href="/static/share.css"></head><body>{{share_id}}</body></html>`)},
		"templates/admin.html": {Data: []byte(`<!doctype html><html><head><script type="module" src="/static/admin.js"></script><link rel="stylesheet" href="/static/admin.css"></head><body><div id="app"></div></body></html>`)},
		"static/admin.css":     {Data: []byte(`body {}`)},
		"static/admin.js":      {Data: []byte(`console.log('admin');`)},
		"static/share.js":      {Data: []byte(`console.log('frontend share');`)},
		"static/share.css":     {Data: []byte(`body { color: #111; }`)},
	}
	server, err := NewServer(share.NewService(store), assets, slog.New(slog.NewTextHandler(io.Discard, nil)), config)
	if err != nil {
		t.Fatal(err)
	}
	return server.Echo()
}

func TestAPIFlow(t *testing.T) {
	handler := testEcho(t)

	create := httptest.NewRequest(http.MethodPost, "/api/share", bytes.NewBufferString(`{"sessionID":"session-1"}`))
	create.Header.Set("Content-Type", "application/json")
	create.Host = "example.com"
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, create)
	if recorder.Code != http.StatusOK {
		t.Fatalf("create status = %d", recorder.Code)
	}

	var created struct {
		ID     string
		Secret string
		URL    string
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.ID != "session-1" || created.Secret == "" || created.URL != "http://example.com/share/session-1" {
		t.Fatalf("unexpected create response: %+v", created)
	}

	syncBody := `{"secret":"` + created.Secret + `","data":[{"_key":"session","title":"ok"}]}`
	sync := httptest.NewRequest(http.MethodPost, "/api/share/session-1/sync", bytes.NewBufferString(syncBody))
	sync.Header.Set("Content-Type", "application/json")
	recorder = httptest.NewRecorder()
	handler.ServeHTTP(recorder, sync)
	if recorder.Code != http.StatusOK {
		t.Fatalf("sync status = %d", recorder.Code)
	}

	get := httptest.NewRequest(http.MethodGet, "/api/share/session-1/data", nil)
	recorder = httptest.NewRecorder()
	handler.ServeHTTP(recorder, get)
	if recorder.Code != http.StatusOK {
		t.Fatalf("get status = %d", recorder.Code)
	}
	var data []map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &data); err != nil {
		t.Fatal(err)
	}
	if len(data) != 1 || data[0]["title"] != "ok" {
		t.Fatalf("unexpected data: %+v", data)
	}

	deleted := request(t, handler, http.MethodDelete, "/api/share/session-1", `{"secret":"`+created.Secret+`"}`)
	if deleted.Code != http.StatusOK {
		t.Fatalf("delete status = %d", deleted.Code)
	}

	afterDelete := request(t, handler, http.MethodGet, "/api/share/session-1/data", "")
	if afterDelete.Code != http.StatusNotFound {
		t.Fatalf("after delete status = %d, want 404", afterDelete.Code)
	}
}

func TestAPIErrors(t *testing.T) {
	handler := testEcho(t)

	badCreate := request(t, handler, http.MethodPost, "/api/share", `{"sessionID":""}`)
	if badCreate.Code != http.StatusBadRequest {
		t.Fatalf("empty session status = %d, want 400", badCreate.Code)
	}

	create := request(t, handler, http.MethodPost, "/api/share", `{"sessionID":"session-2"}`)
	if create.Code != http.StatusOK {
		t.Fatalf("create status = %d", create.Code)
	}
	duplicate := request(t, handler, http.MethodPost, "/api/share", `{"sessionID":"session-2"}`)
	if duplicate.Code != http.StatusConflict {
		t.Fatalf("duplicate status = %d, want 409", duplicate.Code)
	}

	invalidSecret := request(t, handler, http.MethodPost, "/api/share/session-2/sync", `{"secret":"bad","data":[]}`)
	if invalidSecret.Code != http.StatusUnauthorized {
		t.Fatalf("invalid secret status = %d, want 401", invalidSecret.Code)
	}

	tooLarge := request(t, handler, http.MethodPost, "/api/share/session-2/sync", `{"secret":"bad","data":["`+strings.Repeat("x", 2<<20)+`"]}`)
	if tooLarge.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("large body status = %d, want 413", tooLarge.Code)
	}
}

func TestSharePageEscapesScriptContext(t *testing.T) {
	handler := testEcho(t)
	sessionID := `session-quote.test`
	body, err := json.Marshal(map[string]string{"sessionID": sessionID})
	if err != nil {
		t.Fatal(err)
	}
	create := request(t, handler, http.MethodPost, "/api/share", string(body))
	if create.Code != http.StatusOK {
		t.Fatalf("create status = %d", create.Code)
	}

	page := request(t, handler, http.MethodGet, "/share/"+sessionID, "")
	if page.Code != http.StatusOK {
		t.Fatalf("page status = %d", page.Code)
	}
	bodyText := page.Body.String()
	if !strings.Contains(bodyText, `window.SHARE_ID = "session-quote.test";`) {
		t.Fatalf("share page does not contain escaped share id assignment: %s", bodyText)
	}
	if !strings.Contains(bodyText, `/static/share.js`) {
		t.Fatalf("share page missing frontend share.js reference: %s", bodyText)
	}
	if !strings.Contains(bodyText, `type="module" src="/static/share.js"`) {
		t.Fatalf("share page missing module share.js reference: %s", bodyText)
	}
	if strings.Contains(bodyText, `/static/frontend`) {
		t.Fatalf("share page still contains frontend static namespace: %s", bodyText)
	}
	if !strings.Contains(bodyText, `/static/share.css`) {
		t.Fatalf("share page missing frontend share.css reference: %s", bodyText)
	}
	if !strings.Contains(bodyText, `session-quote.test`) {
		t.Fatalf("share page does not contain escaped share id: %s", page.Body.String())
	}
	if strings.Contains(bodyText, `/static/vendor`) {
		t.Fatalf("share page still contains /static/vendor reference: %s", bodyText)
	}
}

// Test that share page does not contain the old frontend static namespace.
func TestSharePageNoFrontendStaticNamespace(t *testing.T) {
	handler := testEcho(t)
	created := createShare(t, handler, "session-static-test")
	page := request(t, handler, http.MethodGet, "/share/"+created.ID, "")
	if page.Code != http.StatusOK {
		t.Fatalf("share page status = %d", page.Code)
	}

	bodyText := page.Body.String()
	forbiddenPaths := []string{
		"/static/frontend",
		"/static/vendor",
	}

	for _, path := range forbiddenPaths {
		if strings.Contains(bodyText, path) {
			t.Fatalf("share page contains forbidden static asset path: %s", path)
		}
	}
}

func TestSharePageAndDataEndpointConsistency(t *testing.T) {
	handler := testEchoWithConfig(t, Config{DefaultSharePassword: "default"})
	created := createShare(t, handler, "session-consistency")

	sync := request(t, handler, http.MethodPost, "/api/share/session-consistency/sync", `{"secret":"`+created.Secret+`","data":[{"_key":"session","title":"ok"}]}`)
	if sync.Code != http.StatusOK {
		t.Fatalf("sync status = %d", sync.Code)
	}

	page := request(t, handler, http.MethodGet, "/share/session-consistency", "")
	if page.Code != http.StatusOK {
		t.Fatalf("page status = %d", page.Code)
	}

	dataBlocked := request(t, handler, http.MethodGet, "/api/share/session-consistency/data", "")
	if dataBlocked.Code != http.StatusUnauthorized {
		t.Fatalf("data without password status = %d, want 401", dataBlocked.Code)
	}

	dataAllowed := requestWithSharePassword(t, handler, "/api/share/session-consistency/data", "default")
	if dataAllowed.Code != http.StatusOK {
		t.Fatalf("data with password status = %d", dataAllowed.Code)
	}
}

func TestRejectsUnsupportedSessionIDCharacters(t *testing.T) {
	handler := testEcho(t)
	create := request(t, handler, http.MethodPost, "/api/share", `{"sessionID":"session/<script>"}`)
	if create.Code != http.StatusBadRequest {
		t.Fatalf("unsupported session status = %d, want 400", create.Code)
	}
}

func TestCreateShareURLFallbackAndForwardedHeaders(t *testing.T) {
	handler := testEcho(t)

	plain := createShare(t, handler, "session-plain")
	if plain.URL != "http://example.com/share/session-plain" {
		t.Fatalf("plain url = %q, want http fallback", plain.URL)
	}

	tlsRequest := httptest.NewRequest(http.MethodPost, "https://example.com/api/share", strings.NewReader(`{"sessionID":"session-tls"}`))
	tlsRequest.Header.Set("Content-Type", "application/json")
	tlsResponse := httptest.NewRecorder()
	handler.ServeHTTP(tlsResponse, tlsRequest)
	if tlsResponse.Code != http.StatusOK {
		t.Fatalf("tls create status = %d", tlsResponse.Code)
	}
	var tlsCreated createResponse
	if err := json.Unmarshal(tlsResponse.Body.Bytes(), &tlsCreated); err != nil {
		t.Fatal(err)
	}
	if tlsCreated.URL != "https://example.com/share/session-tls" {
		t.Fatalf("tls url = %q, want https fallback", tlsCreated.URL)
	}

	forwardedRequest := httptest.NewRequest(http.MethodPost, "/api/share", strings.NewReader(`{"sessionID":"session-forwarded"}`))
	forwardedRequest.Header.Set("Content-Type", "application/json")
	forwardedRequest.Header.Set("X-Forwarded-Proto", "https")
	forwardedRequest.Header.Set("X-Forwarded-Protocol", "http")
	forwardedRequest.Header.Set("X-Forwarded-Host", "public.example")
	forwardedRequest.Host = "internal.example"
	forwardedResponse := httptest.NewRecorder()
	handler.ServeHTTP(forwardedResponse, forwardedRequest)
	if forwardedResponse.Code != http.StatusOK {
		t.Fatalf("forwarded create status = %d", forwardedResponse.Code)
	}
	var forwardedCreated createResponse
	if err := json.Unmarshal(forwardedResponse.Body.Bytes(), &forwardedCreated); err != nil {
		t.Fatal(err)
	}
	if forwardedCreated.URL != "https://public.example/share/session-forwarded" {
		t.Fatalf("forwarded url = %q", forwardedCreated.URL)
	}
}

func TestRealIPUsesXForwardedForExtractor(t *testing.T) {
	app, ok := testEcho(t).(*echo.Echo)
	if !ok {
		t.Fatal("handler is not *echo.Echo")
	}

	app.GET("/real-ip", func(c echo.Context) error {
		return c.String(http.StatusOK, c.RealIP())
	})

	req := httptest.NewRequest(http.MethodGet, "/real-ip", nil)
	req.Header.Set("X-Forwarded-For", "198.51.100.10, 203.0.113.10")
	req.RemoteAddr = "10.0.0.1:1234"
	req.Host = "example.com"

	res := httptest.NewRecorder()
	app.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("real ip status = %d", res.Code)
	}
	if got := strings.TrimSpace(res.Body.String()); got != "203.0.113.10" {
		t.Fatalf("real ip = %q, want %q", got, "203.0.113.10")
	}
}

func TestCreateSharePersistsClientIP(t *testing.T) {
	store, err := share.OpenStore(filepath.Join(t.TempDir(), "share.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })

	service := share.NewService(store)
	assets := fstest.MapFS{
		"templates/share.html": {Data: []byte(`<!doctype html><html><head><script>window.SHARE_ID = "{{share_id}}";</script><script type="module" src="/static/share.js"></script><link rel="stylesheet" href="/static/share.css"></head><body>{{share_id}}</body></html>`)},
		"templates/admin.html": {Data: []byte(`<!doctype html><html><head><script type="module" src="/static/admin.js"></script><link rel="stylesheet" href="/static/admin.css"></head><body><div id="app"></div></body></html>`)},
		"static/admin.css":     {Data: []byte(`body {}`)},
		"static/admin.js":      {Data: []byte(`console.log('admin');`)},
		"static/share.js":      {Data: []byte(`console.log('frontend share');`)},
		"static/share.css":     {Data: []byte(`body { color: #111; }`)},
	}
	server, err := NewServer(service, assets, slog.New(slog.NewTextHandler(io.Discard, nil)), Config{})
	if err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(http.MethodPost, "/api/share", strings.NewReader(`{"sessionID":"session-client-ip"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Forwarded-For", "198.51.100.10, 203.0.113.10")
	request.RemoteAddr = "10.0.0.1:1234"
	request.Host = "example.com"

	response := httptest.NewRecorder()
	server.Echo().ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("create status = %d", response.Code)
	}

	stored, found, err := service.Get("session-client-ip")
	if err != nil {
		t.Fatal(err)
	}
	if !found {
		t.Fatal("stored share not found")
	}
	if stored.ClientIP != "203.0.113.10" {
		t.Fatalf("stored.ClientIP = %q, want %q", stored.ClientIP, "203.0.113.10")
	}
}

func TestAccessLogIncludesClientIP(t *testing.T) {
	var logs bytes.Buffer
	store, err := share.OpenStore(filepath.Join(t.TempDir(), "share.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })

	assets := fstest.MapFS{
		"templates/share.html": {Data: []byte(`<!doctype html><html><head><script>window.SHARE_ID = "{{share_id}}";</script><script type="module" src="/static/share.js"></script><link rel="stylesheet" href="/static/share.css"></head><body>{{share_id}}</body></html>`)},
		"templates/admin.html": {Data: []byte(`<!doctype html><html><head><script type="module" src="/static/admin.js"></script><link rel="stylesheet" href="/static/admin.css"></head><body><div id="app"></div></body></html>`)},
		"static/admin.css":     {Data: []byte(`body {}`)},
		"static/admin.js":      {Data: []byte(`console.log('admin');`)},
		"static/share.js":      {Data: []byte(`console.log('frontend share');`)},
		"static/share.css":     {Data: []byte(`body { color: #111; }`)},
	}
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	server, err := NewServer(share.NewService(store), assets, logger, Config{})
	if err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Set("X-Forwarded-For", "198.51.100.10, 203.0.113.10")
	request.RemoteAddr = "10.0.0.1:1234"
	request.Host = "example.com"

	response := httptest.NewRecorder()
	server.Echo().ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("index status = %d", response.Code)
	}
	if got := logs.String(); !strings.Contains(got, `"client_ip":"203.0.113.10"`) {
		t.Fatalf("log output missing client_ip: %s", got)
	}
}

func TestAdminListsAndSetsSharePassword(t *testing.T) {
	handler := testEchoWithConfig(t, Config{AdminPassword: "admin"})
	created := createShare(t, handler, "session-admin")

	unauthorized := request(t, handler, http.MethodGet, "/admin", "")
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("admin without auth = %d, want 401", unauthorized.Code)
	}
	wrongAuth := requestAuth(t, handler, http.MethodGet, "/admin", "", "wrong")
	if wrongAuth.Code != http.StatusUnauthorized {
		t.Fatalf("admin wrong auth = %d, want 401", wrongAuth.Code)
	}
	page := requestAuth(t, handler, http.MethodGet, "/admin", "", "admin")
	if page.Code != http.StatusOK {
		t.Fatalf("admin page status = %d", page.Code)
	}
	bodyText := page.Body.String()
	if !strings.Contains(bodyText, `id="app"`) {
		t.Fatalf("admin page missing #app mount: %s", bodyText)
	}
	if !strings.Contains(bodyText, `/static/admin.js`) {
		t.Fatalf("admin page missing frontend admin.js reference: %s", bodyText)
	}
	if !strings.Contains(bodyText, `type="module" src="/static/admin.js"`) {
		t.Fatalf("admin page missing module admin.js reference: %s", bodyText)
	}
	if !strings.Contains(bodyText, `/static/admin.css`) {
		t.Fatalf("admin page missing frontend admin.css reference: %s", bodyText)
	}
	if strings.Contains(bodyText, `/static/frontend`) {
		t.Fatalf("admin page still contains frontend static namespace: %s", bodyText)
	}

	list := requestAuth(t, handler, http.MethodGet, "/api/admin/shares", "", "admin")
	if list.Code != http.StatusOK {
		t.Fatalf("admin list status = %d", list.Code)
	}
	if !strings.Contains(list.Body.String(), "session-admin") {
		t.Fatalf("admin list missing session: %s", list.Body.String())
	}
	if !strings.Contains(list.Body.String(), `"clientIP":"`) {
		t.Fatalf("admin list missing clientIP field: %s", list.Body.String())
	}

	set := requestAuth(t, handler, http.MethodPut, "/api/admin/share/session-admin/password", `{"password":"view"}`, "admin")
	if set.Code != http.StatusOK {
		t.Fatalf("set password status = %d", set.Code)
	}

	blocked := request(t, handler, http.MethodGet, "/api/share/session-admin/data", "")
	if blocked.Code != http.StatusUnauthorized {
		t.Fatalf("protected data status = %d, want 401", blocked.Code)
	}

	sync := request(t, handler, http.MethodPost, "/api/share/session-admin/sync", `{"secret":"`+created.Secret+`","data":[{"_key":"session","title":"ok"}]}`)
	if sync.Code != http.StatusOK {
		t.Fatalf("sync status = %d", sync.Code)
	}

	allowed := requestWithSharePassword(t, handler, "/api/share/session-admin/data", "view")
	if allowed.Code != http.StatusOK {
		t.Fatalf("password data status = %d", allowed.Code)
	}
	if allowed.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("password data cache-control = %q, want no-store", allowed.Header().Get("Cache-Control"))
	}
}

func TestAdminDisabledWithoutPassword(t *testing.T) {
	handler := testEcho(t)
	admin := request(t, handler, http.MethodGet, "/admin", "")
	if admin.Code != http.StatusServiceUnavailable {
		t.Fatalf("admin disabled status = %d, want 503", admin.Code)
	}
}

// Test that admin page does not contain the old frontend static namespace.
func TestAdminPageNoFrontendStaticNamespace(t *testing.T) {
	handler := testEchoWithConfig(t, Config{AdminPassword: "admin"})
	createShare(t, handler, "session-admin-static-test")
	page := requestAuth(t, handler, http.MethodGet, "/admin", "", "admin")
	if page.Code != http.StatusOK {
		t.Fatalf("admin page status = %d", page.Code)
	}

	bodyText := page.Body.String()
	forbiddenPaths := []string{
		"/static/frontend",
		"/static/vendor",
	}

	for _, path := range forbiddenPaths {
		if strings.Contains(bodyText, path) {
			t.Fatalf("admin page contains forbidden static asset path: %s", path)
		}
	}
}

func TestDefaultSharePassword(t *testing.T) {
	handler := testEchoWithConfig(t, Config{DefaultSharePassword: "default"})
	created := createShare(t, handler, "session-default")
	sync := request(t, handler, http.MethodPost, "/api/share/session-default/sync", `{"secret":"`+created.Secret+`","data":[{"_key":"session"}]}`)
	if sync.Code != http.StatusOK {
		t.Fatalf("sync status = %d", sync.Code)
	}
	blocked := request(t, handler, http.MethodGet, "/api/share/session-default/data", "")
	if blocked.Code != http.StatusUnauthorized {
		t.Fatalf("default protected status = %d, want 401", blocked.Code)
	}
	allowed := requestWithSharePassword(t, handler, "/api/share/session-default/data", "default")
	if allowed.Code != http.StatusOK {
		t.Fatalf("default password status = %d", allowed.Code)
	}
	if allowed.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("default password cache-control = %q, want no-store", allowed.Header().Get("Cache-Control"))
	}
}

func TestQueryPasswordIsIgnored(t *testing.T) {
	handler := testEchoWithConfig(t, Config{DefaultSharePassword: "default"})
	created := createShare(t, handler, "session-query")
	sync := request(t, handler, http.MethodPost, "/api/share/session-query/sync", `{"secret":"`+created.Secret+`","data":[{"_key":"session"}]}`)
	if sync.Code != http.StatusOK {
		t.Fatalf("sync status = %d", sync.Code)
	}
	query := request(t, handler, http.MethodGet, "/api/share/session-query/data?password=default", "")
	if query.Code != http.StatusUnauthorized {
		t.Fatalf("query password status = %d, want 401", query.Code)
	}
	if query.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("query password cache-control = %q, want no-store", query.Header().Get("Cache-Control"))
	}
}

type createResponse struct {
	ID     string
	Secret string
	URL    string
}

func createShare(t *testing.T, handler http.Handler, id string) createResponse {
	t.Helper()
	response := request(t, handler, http.MethodPost, "/api/share", `{"sessionID":"`+id+`"}`)
	if response.Code != http.StatusOK {
		t.Fatalf("create %s status = %d", id, response.Code)
	}
	var created createResponse
	if err := json.Unmarshal(response.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	return created
}

func request(t *testing.T, handler http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	request.Host = "example.com"
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func requestAuth(t *testing.T, handler http.Handler, method, path, body, password string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	request.SetBasicAuth("admin", password)
	request.Host = "example.com"
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func requestWithSharePassword(t *testing.T, handler http.Handler, path, password string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(http.MethodGet, path, nil)
	request.Header.Set("X-Share-Password", password)
	request.Host = "example.com"
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}
