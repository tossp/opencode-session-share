package assets

import "embed"

// FS contains the share page template and static frontend assets.
//
//go:embed static templates
var FS embed.FS
