package web

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"html"
	"io/fs"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/tossp/opencode-session-share/internal/share"
)

const manifestPath = "manifest.json"

// Server exposes the opencode-share Echo application.
type Server struct {
	shares               *share.Service
	shareTemplate        string
	adminTemplate        string
	logger               *slog.Logger
	staticFS             fs.FS
	adminPassword        string
	defaultSharePassword string
}

// Config controls optional access protection.
type Config struct {
	AdminPassword        string
	DefaultSharePassword string
}

// NewServer creates an Echo-backed server.
func NewServer(shares *share.Service, assets fs.FS, logger *slog.Logger, config Config) (*Server, error) {
	shareTemplate, err := fs.ReadFile(assets, "templates/share.html")
	if err != nil {
		return nil, err
	}
	adminTemplate, err := fs.ReadFile(assets, "templates/admin.html")
	if err != nil {
		return nil, err
	}
	staticFS, err := fs.Sub(assets, "static")
	if err != nil {
		return nil, err
	}
	assetPaths, err := loadAssetPaths(staticFS)
	if err != nil {
		return nil, err
	}
	shareTemplateText := renderStaticAssets(string(shareTemplate), assetPaths)
	adminTemplateText := renderStaticAssets(string(adminTemplate), assetPaths)
	if logger == nil {
		logger = slog.Default()
	}
	return &Server{
		shares:               shares,
		shareTemplate:        shareTemplateText,
		adminTemplate:        adminTemplateText,
		logger:               logger,
		staticFS:             staticFS,
		adminPassword:        config.AdminPassword,
		defaultSharePassword: config.DefaultSharePassword,
	}, nil
}

type manifestEntry struct {
	File string   `json:"file"`
	CSS  []string `json:"css"`
}

type staticAssetPaths struct {
	AdminCSS    string
	AdminJS     string
	FaviconHref string
	ShareCSS    string
	ShareJS     string
}

func loadAssetPaths(staticFS fs.FS) (staticAssetPaths, error) {
	manifest, err := readManifest(staticFS)
	if err != nil {
		return staticAssetPaths{}, err
	}

	share, err := manifestAsset(manifest, "src/apps/share/main.ts")
	if err != nil {
		return staticAssetPaths{}, err
	}
	admin, err := manifestAsset(manifest, "src/apps/admin/main.ts")
	if err != nil {
		return staticAssetPaths{}, err
	}
	shareCSS, err := firstCSS(share)
	if err != nil {
		return staticAssetPaths{}, err
	}
	adminCSS, err := firstCSS(admin)
	if err != nil {
		return staticAssetPaths{}, err
	}
	for _, path := range []string{share.File, shareCSS, admin.File, adminCSS, "favicon.ico"} {
		if _, err := fs.Stat(staticFS, path); err != nil {
			return staticAssetPaths{}, err
		}
	}

	return staticAssetPaths{
		AdminCSS:    staticURL(adminCSS),
		AdminJS:     staticURL(admin.File),
		FaviconHref: "/static/favicon.ico",
		ShareCSS:    staticURL(shareCSS),
		ShareJS:     staticURL(share.File),
	}, nil
}

func readManifest(staticFS fs.FS) (map[string]manifestEntry, error) {
	data, err := fs.ReadFile(staticFS, manifestPath)
	if err != nil {
		return nil, err
	}
	var manifest map[string]manifestEntry
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, err
	}
	return manifest, nil
}

func manifestAsset(manifest map[string]manifestEntry, key string) (manifestEntry, error) {
	entry, ok := manifest[key]
	if !ok || entry.File == "" {
		return manifestEntry{}, fs.ErrNotExist
	}
	return entry, nil
}

func firstCSS(entry manifestEntry) (string, error) {
	if len(entry.CSS) == 0 || entry.CSS[0] == "" {
		return "", fs.ErrNotExist
	}
	return entry.CSS[0], nil
}

func renderStaticAssets(template string, paths staticAssetPaths) string {
	replacements := map[string]string{
		"{{admin_css}}":    paths.AdminCSS,
		"{{admin_js}}":     paths.AdminJS,
		"{{favicon_href}}": paths.FaviconHref,
		"{{share_css}}":    paths.ShareCSS,
		"{{share_js}}":     paths.ShareJS,
	}
	for placeholder, value := range replacements {
		template = strings.ReplaceAll(template, placeholder, value)
	}
	return template
}

func staticURL(path string) string {
	return "/static/" + strings.TrimPrefix(path, "/")
}

// Echo builds the full Echo application.
func (s *Server) Echo() *echo.Echo {
	e := echo.New()
	e.IPExtractor = echo.ExtractIPFromXFFHeader()
	e.HideBanner = true
	e.HidePort = true
	e.HTTPErrorHandler = errorHandler
	e.Use(middleware.CORS())
	e.Use(middleware.BodyLimit("2M"))
	e.Use(s.accessLog)

	e.GET("/", s.index)
	e.POST("/api/share", s.createShare)
	e.POST("/api/share/:share_id/sync", s.syncShare)
	e.GET("/api/share/:share_id/data", s.getShareData)
	e.DELETE("/api/share/:share_id", s.removeShare)
	e.GET("/share/:share_id", s.sharePage)
	e.GET("/admin", s.adminPage, s.requireAdmin)
	e.GET("/api/admin/shares", s.adminShares, s.requireAdmin)
	e.PUT("/api/admin/share/:share_id/password", s.adminSetPassword, s.requireAdmin)
	e.GET("/static/*", echo.WrapHandler(http.StripPrefix("/static/", http.FileServer(http.FS(s.staticFS)))))
	return e
}

func (s *Server) index(c echo.Context) error {
	return c.String(http.StatusOK, "Hello World")
}

func (s *Server) createShare(c echo.Context) error {
	var request struct {
		SessionID string `json:"sessionID"`
	}
	if err := c.Bind(&request); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "JSON 格式无效")
	}

	record, err := s.shares.Create(request.SessionID, c.RealIP())
	if err != nil {
		return serviceError(err)
	}

	return c.JSON(http.StatusOK, struct {
		ID     string `json:"id"`
		Secret string `json:"secret"`
		URL    string `json:"url"`
	}{
		ID:     record.ID,
		Secret: record.Secret,
		URL:    publicURL(c.Request(), record.ID),
	})
}

func (s *Server) syncShare(c echo.Context) error {
	var request struct {
		Secret string            `json:"secret"`
		Data   []json.RawMessage `json:"data"`
	}
	if err := c.Bind(&request); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "JSON 格式无效")
	}
	if err := s.shares.Sync(c.Param("share_id"), request.Secret, request.Data); err != nil {
		return serviceError(err)
	}
	return c.NoContent(http.StatusOK)
}

func (s *Server) getShareData(c echo.Context) error {
	shareID := c.Param("share_id")
	password := c.Request().Header.Get("X-Share-Password")
	if password != "" || s.defaultSharePassword != "" {
		c.Response().Header().Set("Cache-Control", "no-store")
	}
	data, err := s.shares.DataWithPassword(shareID, password, s.defaultSharePassword)
	if err != nil {
		return serviceError(err)
	}
	return c.JSON(http.StatusOK, data)
}

func (s *Server) adminPage(c echo.Context) error {
	c.Response().Header().Set("Cache-Control", "no-store")
	return c.HTML(http.StatusOK, s.adminTemplate)
}

func (s *Server) adminShares(c echo.Context) error {
	summaries, err := s.shares.List(s.defaultSharePassword)
	if err != nil {
		return serviceError(err)
	}
	return c.JSON(http.StatusOK, summaries)
}

func (s *Server) adminSetPassword(c echo.Context) error {
	var request struct {
		Password string `json:"password"`
	}
	if err := c.Bind(&request); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "JSON 格式无效")
	}
	if err := s.shares.SetPassword(c.Param("share_id"), request.Password); err != nil {
		return serviceError(err)
	}
	return c.NoContent(http.StatusOK)
}

func (s *Server) removeShare(c echo.Context) error {
	var request struct {
		Secret string `json:"secret"`
	}
	if err := c.Bind(&request); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "JSON 格式无效")
	}
	if err := s.shares.Remove(c.Param("share_id"), request.Secret); err != nil {
		return serviceError(err)
	}
	return c.NoContent(http.StatusOK)
}

func (s *Server) sharePage(c echo.Context) error {
	shareID := c.Param("share_id")
	if _, found, err := s.shares.Get(shareID); err != nil {
		return serviceError(err)
	} else if !found {
		return echo.NewHTTPError(http.StatusNotFound, "分享不存在")
	}
	escaped := html.EscapeString(jsonStringContent(shareID))
	c.Response().Header().Set("Cache-Control", "no-store")
	return c.HTML(http.StatusOK, strings.ReplaceAll(s.shareTemplate, "{{share_id}}", escaped))
}

func (s *Server) accessLog(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		start := time.Now()
		err := next(c)
		s.logger.Info("http request",
			slog.String("method", c.Request().Method),
			slog.String("path", c.Request().URL.Path),
			slog.String("client_ip", c.RealIP()),
			slog.Int("status", c.Response().Status),
			slog.Duration("duration", time.Since(start).Round(time.Millisecond)),
		)
		return err
	}
}

func (s *Server) requireAdmin(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		if s.adminPassword == "" {
			return echo.NewHTTPError(http.StatusServiceUnavailable, "管理员功能未启用")
		}
		_, password, ok := c.Request().BasicAuth()
		if !ok || subtle.ConstantTimeCompare([]byte(password), []byte(s.adminPassword)) != 1 {
			c.Response().Header().Set("WWW-Authenticate", `Basic realm="opencode-share-admin"`)
			return echo.NewHTTPError(http.StatusUnauthorized, "需要管理员密码")
		}
		return next(c)
	}
}

func serviceError(err error) error {
	switch {
	case errors.Is(err, share.ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, "输入无效")
	case errors.Is(err, share.ErrAlreadyExists):
		return echo.NewHTTPError(http.StatusConflict, "分享已存在")
	case errors.Is(err, share.ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, "分享不存在")
	case errors.Is(err, share.ErrInvalidSecret):
		return echo.NewHTTPError(http.StatusUnauthorized, "分享密钥无效")
	default:
		return echo.NewHTTPError(http.StatusInternalServerError, "服务器内部错误")
	}
}

func errorHandler(err error, c echo.Context) {
	if c.Response().Committed {
		return
	}
	var httpErr *echo.HTTPError
	if errors.As(err, &httpErr) {
		message := http.StatusText(httpErr.Code)
		if text, ok := httpErr.Message.(string); ok && text != "" {
			message = text
		}
		if writeErr := c.String(httpErr.Code, message); writeErr != nil {
			c.Logger().Error(writeErr)
		}
		return
	}
	if writeErr := c.String(http.StatusInternalServerError, "服务器内部错误"); writeErr != nil {
		c.Logger().Error(writeErr)
	}
}

func publicURL(r *http.Request, shareID string) string {
	protocol := r.Header.Get("X-Forwarded-Proto")
	if protocol == "" {
		protocol = r.Header.Get("X-Forwarded-Protocol")
	}
	if protocol == "" {
		if r.TLS != nil {
			protocol = "https"
		} else {
			protocol = "http"
		}
	}

	host := r.Header.Get("X-Forwarded-Host")
	if host == "" {
		host = r.Host
	}
	if host == "" {
		host = "localhost:3006"
	}
	return protocol + "://" + host + "/share/" + url.PathEscape(shareID)
}

func jsonStringContent(value string) string {
	encoded, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	text := string(encoded)
	return strings.TrimSuffix(strings.TrimPrefix(text, "\""), "\"")
}
