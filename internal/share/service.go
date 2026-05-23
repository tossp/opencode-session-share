package share

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

const (
	// MaxSessionIDLength limits user-controlled keys stored in the database.
	MaxSessionIDLength = 512
	// MaxSyncItems limits one sync request's event count.
	MaxSyncItems = 10_000
	// MaxItemBytes limits one JSON event's encoded size.
	MaxItemBytes = 1 << 20
	// MaxShareDataBytes limits a share's accumulated encoded data size.
	MaxShareDataBytes = 32 << 20
)

var (
	// ErrAlreadyExists is returned when a session has already been shared.
	ErrAlreadyExists = errors.New("分享已存在")
	// ErrNotFound is returned when a share does not exist.
	ErrNotFound = errors.New("分享不存在")
	// ErrInvalidSecret is returned when a secret does not match the share.
	ErrInvalidSecret = errors.New("分享密钥无效")
	// ErrInvalidInput is returned when client input is malformed or too large.
	ErrInvalidInput = errors.New("输入无效")
)

// Share is a persisted opencode session share.
type Share struct {
	ID        string            `json:"id"`
	Secret    string            `json:"secret"`
	SessionID string            `json:"sessionID"`
	ClientIP  string            `json:"clientIP"`
	Data      []json.RawMessage `json:"data"`
	Password  string            `json:"password"`
	CreatedAt time.Time         `json:"createdAt"`
	UpdatedAt time.Time         `json:"updatedAt"`
}

// Summary describes one share for administrator views.
type Summary struct {
	ID              string    `json:"id"`
	SessionID       string    `json:"sessionID"`
	ClientIP        string    `json:"clientIP"`
	Items           int       `json:"items"`
	HasPassword     bool      `json:"hasPassword"`
	UsesDefaultPass bool      `json:"usesDefaultPassword"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// Service provides share business operations.
type Service struct {
	store *Store
}

// NewService creates a share service backed by store.
func NewService(store *Store) *Service {
	return &Service{store: store}
}

// Create creates a new share whose ID matches the opencode session ID.
func (s *Service) Create(sessionID, clientIP string) (Share, error) {
	if err := validateSessionID(sessionID); err != nil {
		return Share{}, err
	}

	now := time.Now().UTC()
	share := Share{
		ID:        sessionID,
		Secret:    uuid.NewString(),
		SessionID: sessionID,
		ClientIP:  clientIP,
		Data:      []json.RawMessage{},
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.store.create(share); err != nil {
		if errors.Is(err, ErrAlreadyExists) {
			return Share{}, fmt.Errorf("%w: %s", ErrAlreadyExists, sessionID)
		}
		return Share{}, err
	}
	return share, nil
}

// Get returns a share by ID.
func (s *Service) Get(id string) (Share, bool, error) {
	return s.store.get(id)
}

// List returns all shares ordered by latest update time.
func (s *Service) List(defaultPassword string) ([]Summary, error) {
	shares, err := s.store.list()
	if err != nil {
		return nil, err
	}
	summaries := make([]Summary, 0, len(shares))
	for _, share := range shares {
		summaries = append(summaries, Summary{
			ID:              share.ID,
			SessionID:       share.SessionID,
			ClientIP:        share.ClientIP,
			Items:           len(share.Data),
			HasPassword:     share.Password != "" || defaultPassword != "",
			UsesDefaultPass: share.Password == "" && defaultPassword != "",
			CreatedAt:       share.CreatedAt,
			UpdatedAt:       share.UpdatedAt,
		})
	}
	return summaries, nil
}

// SetPassword replaces a share's per-session view password.
func (s *Service) SetPassword(id, password string) error {
	if len(password) > MaxItemBytes {
		return fmt.Errorf("%w: 密码过长", ErrInvalidInput)
	}
	return s.store.update(id, func(share *Share) error {
		share.Password = password
		share.UpdatedAt = time.Now().UTC()
		return nil
	})
}

// CheckViewPassword verifies a share view password, considering the default password.
func (s *Service) CheckViewPassword(id, password, defaultPassword string) error {
	share, found, err := s.store.get(id)
	if err != nil {
		return err
	}
	if !found {
		return fmt.Errorf("%w: %s", ErrNotFound, id)
	}
	return checkViewPassword(share, password, defaultPassword)
}

// Remove deletes a share after validating its secret.
func (s *Service) Remove(id, secret string) error {
	return s.store.deleteIf(id, func(share Share) error {
		if share.Secret != secret {
			return fmt.Errorf("%w: %s", ErrInvalidSecret, id)
		}
		return nil
	})
}

// Sync merges incoming JSON items into a share after validating its secret.
func (s *Service) Sync(id, secret string, incoming []json.RawMessage) error {
	if len(incoming) > MaxSyncItems {
		return fmt.Errorf("%w: 数据条目过多", ErrInvalidInput)
	}

	return s.store.update(id, func(share *Share) error {
		if share.Secret != secret {
			return fmt.Errorf("%w: %s", ErrInvalidSecret, id)
		}

		merged := append([]json.RawMessage(nil), share.Data...)
		for _, item := range incoming {
			if len(item) > MaxItemBytes {
				return fmt.Errorf("%w: 单条数据过大", ErrInvalidInput)
			}
			if !json.Valid(item) {
				return fmt.Errorf("%w: JSON 数据项无效", ErrInvalidInput)
			}
			key, keyed := dataKey(item)
			merged = mergeData(merged, item, key, keyed)
		}
		if dataSize(merged) > MaxShareDataBytes {
			return fmt.Errorf("%w: 分享数据总量过大", ErrInvalidInput)
		}

		share.Data = merged
		share.UpdatedAt = time.Now().UTC()
		return nil
	})
}

func validateSessionID(sessionID string) error {
	if sessionID == "" {
		return fmt.Errorf("%w: sessionID 不能为空", ErrInvalidInput)
	}
	if len(sessionID) > MaxSessionIDLength {
		return fmt.Errorf("%w: sessionID 过长", ErrInvalidInput)
	}
	for _, r := range sessionID {
		if !isSessionIDChar(r) {
			return fmt.Errorf("%w: sessionID 包含不支持的字符", ErrInvalidInput)
		}
	}
	return nil
}

func isSessionIDChar(r rune) bool {
	return r >= 'a' && r <= 'z' ||
		r >= 'A' && r <= 'Z' ||
		r >= '0' && r <= '9' ||
		r == '-' || r == '_' || r == '.' || r == ':'
}

func dataSize(items []json.RawMessage) int {
	size := 2
	for i, item := range items {
		if i > 0 {
			size++
		}
		size += len(item)
	}
	return size
}

// Data returns the stored JSON event array for a share.
func (s *Service) Data(id string) ([]json.RawMessage, error) {
	share, found, err := s.store.get(id)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, fmt.Errorf("%w: %s", ErrNotFound, id)
	}
	return append([]json.RawMessage(nil), share.Data...), nil
}

// DataWithPassword verifies a share view password and returns its JSON event array.
func (s *Service) DataWithPassword(id, password, defaultPassword string) ([]json.RawMessage, error) {
	share, found, err := s.store.get(id)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, fmt.Errorf("%w: %s", ErrNotFound, id)
	}
	if err := checkViewPassword(share, password, defaultPassword); err != nil {
		return nil, err
	}
	return append([]json.RawMessage(nil), share.Data...), nil
}

func checkViewPassword(share Share, password, defaultPassword string) error {
	required := share.Password
	if required == "" {
		required = defaultPassword
	}
	if required != "" && password != required {
		return fmt.Errorf("%w: %s", ErrInvalidSecret, share.ID)
	}
	return nil
}

func mergeData(current []json.RawMessage, item json.RawMessage, key string, keyed bool) []json.RawMessage {
	if !keyed {
		return append(current, append(json.RawMessage(nil), item...))
	}

	for i, existing := range current {
		existingKey, existingKeyed := dataKey(existing)
		if existingKeyed && existingKey == key {
			current[i] = append(json.RawMessage(nil), item...)
			return current
		}
	}
	return append(current, append(json.RawMessage(nil), item...))
}

func dataKey(data json.RawMessage) (string, bool) {
	var object map[string]json.RawMessage
	if err := json.Unmarshal(data, &object); err != nil {
		return "", false
	}

	var key string
	if raw, ok := object["_key"]; ok && json.Unmarshal(raw, &key) == nil && key != "" {
		return key, true
	}
	return "", false
}
