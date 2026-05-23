package share

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"strings"
	"testing"
)

func newTestService(t *testing.T) *Service {
	t.Helper()
	store, err := OpenStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("OpenStore() error = %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })
	return NewService(store)
}

func TestCreateDuplicateShare(t *testing.T) {
	service := newTestService(t)
	if _, err := service.Create("session-1", ""); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if _, err := service.Create("session-1", ""); !errors.Is(err, ErrAlreadyExists) {
		t.Fatalf("Create() duplicate error = %v, want ErrAlreadyExists", err)
	}
}

func TestSyncReplacesByKeyAndAppendsWithoutKey(t *testing.T) {
	service := newTestService(t)
	created, err := service.Create("session-sync", "")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	first := rawMessages(t, `{"_key":"session","title":"old"}`, `{"content":"append 1"}`)
	if syncErr := service.Sync(created.ID, created.Secret, first); syncErr != nil {
		t.Fatalf("Sync(first) error = %v", syncErr)
	}
	second := rawMessages(t, `{"_key":"session","title":"new"}`, `{"content":"append 2"}`)
	if syncErr := service.Sync(created.ID, created.Secret, second); syncErr != nil {
		t.Fatalf("Sync(second) error = %v", syncErr)
	}

	data, err := service.Data(created.ID)
	if err != nil {
		t.Fatalf("Data() error = %v", err)
	}
	if len(data) != 3 {
		t.Fatalf("len(data) = %d, want 3", len(data))
	}

	var session map[string]string
	if err := json.Unmarshal(data[0], &session); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	if session["title"] != "new" {
		t.Fatalf("session title = %q, want new", session["title"])
	}
}

func TestInvalidSecret(t *testing.T) {
	service := newTestService(t)
	created, err := service.Create("session-secret", "")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if err := service.Remove(created.ID, "bad-secret"); !errors.Is(err, ErrInvalidSecret) {
		t.Fatalf("Remove() error = %v, want ErrInvalidSecret", err)
	}
}

func TestRejectsInvalidSessionID(t *testing.T) {
	service := newTestService(t)
	if _, err := service.Create("session/<script>", ""); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("Create() error = %v, want ErrInvalidInput", err)
	}
}

func TestRejectsOversizedSyncItem(t *testing.T) {
	service := newTestService(t)
	created, err := service.Create("session-size", "")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	oversized := json.RawMessage(`{"payload":"` + strings.Repeat("x", MaxItemBytes+1) + `"}`)
	if err := service.Sync(created.ID, created.Secret, []json.RawMessage{oversized}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("Sync() error = %v, want ErrInvalidInput", err)
	}
}

func TestCreateAcceptsAndRejectsSessionIDLengthBoundary(t *testing.T) {
	service := newTestService(t)

	valid := strings.Repeat("a", MaxSessionIDLength)
	created, err := service.Create(valid, "")
	if err != nil {
		t.Fatalf("Create(valid) error = %v", err)
	}
	if created.ID != valid {
		t.Fatalf("created.ID = %q, want %q", created.ID, valid)
	}

	invalid := strings.Repeat("a", MaxSessionIDLength+1)
	if _, err := service.Create(invalid, ""); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("Create(invalid) error = %v, want ErrInvalidInput", err)
	}
}

func TestSyncRejectsIncomingItemsOverMaxSyncItems(t *testing.T) {
	service := newTestService(t)
	created, err := service.Create("session-sync-limit", "")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	incoming := make([]json.RawMessage, MaxSyncItems+1)
	for i := range incoming {
		incoming[i] = json.RawMessage(`{"idx":1}`)
	}

	if err := service.Sync(created.ID, created.Secret, incoming); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("Sync() error = %v, want ErrInvalidInput", err)
	}
}

func TestSyncRejectsShareDataOverMaxShareDataBytes(t *testing.T) {
	service := newTestService(t)
	created, err := service.Create("session-total-size", "")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	fill := make([]json.RawMessage, 0, 32)
	maxItem := rawMessageOfLength(t, MaxItemBytes)
	for {
		candidate := append(append([]json.RawMessage(nil), fill...), maxItem)
		if dataSize(candidate) > MaxShareDataBytes {
			break
		}
		fill = candidate
	}
	fillerLen := MaxShareDataBytes - dataSize(fill) - 1
	fill = append(fill, rawMessageOfLength(t, fillerLen))
	if got := dataSize(fill); got != MaxShareDataBytes {
		t.Fatalf("dataSize(fill) = %d, want %d", got, MaxShareDataBytes)
	}

	if err := service.Sync(created.ID, created.Secret, fill); err != nil {
		t.Fatalf("Sync(fill) error = %v", err)
	}

	if err := service.Sync(created.ID, created.Secret, []json.RawMessage{json.RawMessage(`0`)}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("Sync(overflow) error = %v, want ErrInvalidInput", err)
	}
}

func TestSetPasswordAcceptsAndRejectsLengthBoundary(t *testing.T) {
	service := newTestService(t)
	created, err := service.Create("session-password-size", "")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	valid := strings.Repeat("p", MaxItemBytes)
	if err := service.SetPassword(created.ID, valid); err != nil {
		t.Fatalf("SetPassword(valid) error = %v", err)
	}

	if err := service.SetPassword(created.ID, strings.Repeat("p", MaxItemBytes+1)); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("SetPassword(invalid) error = %v, want ErrInvalidInput", err)
	}
}

func TestDataWithPasswordUsesDefaultPassword(t *testing.T) {
	service := newTestService(t)
	created, createErr := service.Create("session-data-default-password", "")
	if createErr != nil {
		t.Fatalf("Create() error = %v", createErr)
	}
	if err := service.Sync(created.ID, created.Secret, rawMessages(t, `{"content":"secret"}`)); err != nil {
		t.Fatalf("Sync() error = %v", err)
	}

	if _, err := service.DataWithPassword(created.ID, "bad", "default-pass"); !errors.Is(err, ErrInvalidSecret) {
		t.Fatalf("DataWithPassword(bad) error = %v, want ErrInvalidSecret", err)
	}
	data, err := service.DataWithPassword(created.ID, "default-pass", "default-pass")
	if err != nil {
		t.Fatalf("DataWithPassword(default) error = %v", err)
	}
	if len(data) != 1 {
		t.Fatalf("len(data) = %d, want 1", len(data))
	}
}

func TestDataWithPasswordSharePasswordOverridesDefault(t *testing.T) {
	service := newTestService(t)
	created, err := service.Create("session-data-share-password", "")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if err := service.SetPassword(created.ID, "share-pass"); err != nil {
		t.Fatalf("SetPassword() error = %v", err)
	}

	if _, err := service.DataWithPassword(created.ID, "default-pass", "default-pass"); !errors.Is(err, ErrInvalidSecret) {
		t.Fatalf("DataWithPassword(default) error = %v, want ErrInvalidSecret", err)
	}
	if _, err := service.DataWithPassword(created.ID, "share-pass", "default-pass"); err != nil {
		t.Fatalf("DataWithPassword(share) error = %v", err)
	}
}

func TestDataWithPasswordReturnsNotFound(t *testing.T) {
	service := newTestService(t)
	if _, err := service.DataWithPassword("missing-share", "", ""); !errors.Is(err, ErrNotFound) {
		t.Fatalf("DataWithPassword() error = %v, want ErrNotFound", err)
	}
}

func TestDataWithPasswordReturnsCopiedDataSlice(t *testing.T) {
	service := newTestService(t)
	created, createErr := service.Create("session-data-copy", "")
	if createErr != nil {
		t.Fatalf("Create() error = %v", createErr)
	}
	if err := service.Sync(created.ID, created.Secret, rawMessages(t, `{"_key":"first","title":"original"}`, `{"_key":"second"}`)); err != nil {
		t.Fatalf("Sync() error = %v", err)
	}

	data, err := service.DataWithPassword(created.ID, "", "")
	if err != nil {
		t.Fatalf("DataWithPassword() error = %v", err)
	}
	data[0] = json.RawMessage(`{"_key":"first","title":"mutated"}`)

	fresh, err := service.DataWithPassword(created.ID, "", "")
	if err != nil {
		t.Fatalf("DataWithPassword(fresh) error = %v", err)
	}
	var first map[string]string
	if err := json.Unmarshal(fresh[0], &first); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	if first["title"] != "original" {
		t.Fatalf("title = %q, want original", first["title"])
	}
}

func TestSyncLastWriteWinsForDuplicateIncomingKey(t *testing.T) {
	service := newTestService(t)
	created, err := service.Create("session-duplicate-key", "")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	incoming := rawMessages(t,
		`{"_key":"same","title":"old"}`,
		`{"_key":"same","title":"new"}`,
	)
	syncErr := service.Sync(created.ID, created.Secret, incoming)
	if syncErr != nil {
		t.Fatalf("Sync() error = %v", syncErr)
	}

	data, err := service.Data(created.ID)
	if err != nil {
		t.Fatalf("Data() error = %v", err)
	}
	if len(data) != 1 {
		t.Fatalf("len(data) = %d, want 1", len(data))
	}

	var got map[string]string
	if err := json.Unmarshal(data[0], &got); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	if got["title"] != "new" {
		t.Fatalf("title = %q, want new", got["title"])
	}
}

func TestSyncMixedKeyedReplacementAndUnkeyedAppend(t *testing.T) {
	service := newTestService(t)
	created, err := service.Create("session-mixed-merge", "")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	seed := rawMessages(t,
		`{"_key":"k1","title":"seed"}`,
		`{"content":"seed append"}`,
	)
	seedErr := service.Sync(created.ID, created.Secret, seed)
	if seedErr != nil {
		t.Fatalf("Sync(seed) error = %v", seedErr)
	}

	update := rawMessages(t,
		`{"_key":"k1","title":"replaced"}`,
		`{"content":"new append"}`,
	)
	updateErr := service.Sync(created.ID, created.Secret, update)
	if updateErr != nil {
		t.Fatalf("Sync(update) error = %v", updateErr)
	}

	data, err := service.Data(created.ID)
	if err != nil {
		t.Fatalf("Data() error = %v", err)
	}
	if len(data) != 3 {
		t.Fatalf("len(data) = %d, want 3", len(data))
	}

	var keyed map[string]string
	if err := json.Unmarshal(data[0], &keyed); err != nil {
		t.Fatalf("Unmarshal(keyed) error = %v", err)
	}
	if keyed["title"] != "replaced" {
		t.Fatalf("title = %q, want replaced", keyed["title"])
	}

	var firstAppend map[string]string
	if err := json.Unmarshal(data[1], &firstAppend); err != nil {
		t.Fatalf("Unmarshal(first append) error = %v", err)
	}
	if firstAppend["content"] != "seed append" {
		t.Fatalf("first append content = %q, want seed append", firstAppend["content"])
	}

	var secondAppend map[string]string
	if err := json.Unmarshal(data[2], &secondAppend); err != nil {
		t.Fatalf("Unmarshal(second append) error = %v", err)
	}
	if secondAppend["content"] != "new append" {
		t.Fatalf("second append content = %q, want new append", secondAppend["content"])
	}
}

func TestCreateAcceptsAllowedSessionIDPunctuation(t *testing.T) {
	service := newTestService(t)

	for _, sessionID := range []string{"session-id", "session_id", "session.id", "session:id"} {
		created, err := service.Create(sessionID, "")
		if err != nil {
			t.Fatalf("Create(%q) error = %v", sessionID, err)
		}
		if created.ID != sessionID {
			t.Fatalf("created.ID = %q, want %q", created.ID, sessionID)
		}
	}
}

func TestSyncAcceptsExactlyMaxSyncItems(t *testing.T) {
	service := newTestService(t)
	created, err := service.Create("session-sync-limit-exact", "")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	incoming := make([]json.RawMessage, MaxSyncItems)
	for i := range incoming {
		incoming[i] = json.RawMessage(`{"idx":1}`)
	}

	if syncErr := service.Sync(created.ID, created.Secret, incoming); syncErr != nil {
		t.Fatalf("Sync() error = %v", syncErr)
	}
	data, dataErr := service.Data(created.ID)
	if dataErr != nil {
		t.Fatalf("Data() error = %v", dataErr)
	}
	if len(data) != MaxSyncItems {
		t.Fatalf("len(data) = %d, want %d", len(data), MaxSyncItems)
	}
}

func TestCreateStoresClientIP(t *testing.T) {
	service := newTestService(t)

	created, err := service.Create("session-client-ip", "203.0.113.10")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if created.ClientIP != "203.0.113.10" {
		t.Fatalf("created.ClientIP = %q, want %q", created.ClientIP, "203.0.113.10")
	}

	stored, found, err := service.Get(created.ID)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if !found {
		t.Fatal("Get() found = false, want true")
	}
	if stored.ClientIP != "203.0.113.10" {
		t.Fatalf("stored.ClientIP = %q, want %q", stored.ClientIP, "203.0.113.10")
	}
}

func TestListIncludesClientIP(t *testing.T) {
	service := newTestService(t)

	created, err := service.Create("session-list-client-ip", "203.0.113.11")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	summaries, err := service.List("")
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(summaries) != 1 {
		t.Fatalf("len(summaries) = %d, want 1", len(summaries))
	}
	if summaries[0].ID != created.ID {
		t.Fatalf("summaries[0].ID = %q, want %q", summaries[0].ID, created.ID)
	}
	if summaries[0].ClientIP != "203.0.113.11" {
		t.Fatalf("summaries[0].ClientIP = %q, want %q", summaries[0].ClientIP, "203.0.113.11")
	}
}

func rawMessages(t *testing.T, values ...string) []json.RawMessage {
	t.Helper()
	messages := make([]json.RawMessage, 0, len(values))
	for _, value := range values {
		message := json.RawMessage(value)
		if !json.Valid(message) {
			t.Fatalf("invalid JSON fixture: %s", value)
		}
		messages = append(messages, message)
	}
	return messages
}

func rawMessageOfLength(t *testing.T, length int) json.RawMessage {
	t.Helper()
	if length <= 0 {
		t.Fatalf("rawMessageOfLength() length = %d, want > 0", length)
	}
	if length == 1 {
		return json.RawMessage(`0`)
	}
	return json.RawMessage(`"` + strings.Repeat("x", length-2) + `"`)
}
