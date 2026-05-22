package share

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"go.etcd.io/bbolt"
)

var bucketShares = []byte("shares")

// Store persists shares in a local bbolt database.
type Store struct {
	db *bbolt.DB
}

// OpenStore opens or creates a local share database.
func OpenStore(path string) (*Store, error) {
	db, err := bbolt.Open(path, 0o600, &bbolt.Options{Timeout: time.Second})
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	store := &Store{db: db}
	if err := store.init(); err != nil {
		_ = db.Close()
		return nil, err
	}

	return store, nil
}

// Close closes the underlying database.
func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) init() error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists(bucketShares)
		if err != nil {
			return fmt.Errorf("create shares bucket: %w", err)
		}
		return nil
	})
}

func (s *Store) create(share Share) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		bucket := tx.Bucket(bucketShares)
		if existing := bucket.Get([]byte(share.ID)); existing != nil {
			return ErrAlreadyExists
		}

		//nolint:gosec // Share.Secret is a required persisted application credential by design.
		encoded, err := json.Marshal(share)
		if err != nil {
			return fmt.Errorf("marshal share: %w", err)
		}

		if err := bucket.Put([]byte(share.ID), encoded); err != nil {
			return fmt.Errorf("save share: %w", err)
		}
		return nil
	})
}

func (s *Store) get(id string) (Share, bool, error) {
	var share Share
	found := false

	err := s.db.View(func(tx *bbolt.Tx) error {
		value := tx.Bucket(bucketShares).Get([]byte(id))
		if value == nil {
			return nil
		}
		found = true
		if err := json.Unmarshal(value, &share); err != nil {
			return fmt.Errorf("decode share %q: %w", id, err)
		}
		return nil
	})

	return share, found, err
}

func (s *Store) list() ([]Share, error) {
	shares := []Share{}
	err := s.db.View(func(tx *bbolt.Tx) error {
		bucket := tx.Bucket(bucketShares)
		return bucket.ForEach(func(_, value []byte) error {
			var share Share
			if err := json.Unmarshal(value, &share); err != nil {
				return fmt.Errorf("decode share: %w", err)
			}
			shares = append(shares, share)
			return nil
		})
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(shares, func(i, j int) bool {
		return shares[i].UpdatedAt.After(shares[j].UpdatedAt)
	})
	return shares, nil
}

func (s *Store) update(id string, update func(*Share) error) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		bucket := tx.Bucket(bucketShares)
		value := bucket.Get([]byte(id))
		if value == nil {
			return ErrNotFound
		}

		var share Share
		if err := json.Unmarshal(value, &share); err != nil {
			return fmt.Errorf("decode share %q: %w", id, err)
		}
		if err := update(&share); err != nil {
			return err
		}

		//nolint:gosec // Share.Secret is a required persisted application credential by design.
		encoded, err := json.Marshal(share)
		if err != nil {
			return fmt.Errorf("marshal share: %w", err)
		}
		if err := bucket.Put([]byte(id), encoded); err != nil {
			return fmt.Errorf("save share %q: %w", id, err)
		}
		return nil
	})
}

func (s *Store) deleteIf(id string, check func(Share) error) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		bucket := tx.Bucket(bucketShares)
		value := bucket.Get([]byte(id))
		if value == nil {
			return ErrNotFound
		}

		var share Share
		if err := json.Unmarshal(value, &share); err != nil {
			return fmt.Errorf("decode share %q: %w", id, err)
		}
		if err := check(share); err != nil {
			return err
		}

		if err := bucket.Delete([]byte(id)); err != nil {
			return fmt.Errorf("delete share %q: %w", id, err)
		}
		return nil
	})
}

// IsNotFound reports whether err means the share does not exist.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

// IsInvalidSecret reports whether err means the provided secret is invalid.
func IsInvalidSecret(err error) bool {
	return errors.Is(err, ErrInvalidSecret)
}
