// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// LOGZ.IO CHANGE START:: Panel-level "Max data points" (Grafana parity) [APPZ-3369]
// The panel spec's `maxDataPoints` replaces the panel's pixel width as the divisor that sets the
// query interval (`time range / points`), matching Grafana's query option of the same name.
// Lives in `model` because both halves need it: the editor field (plugin-system) and the two
// places that build query options from a panel spec (dashboards).

/** One point is extreme but meaningful — it is what an "instant" panel already asks for. */
export const MIN_MAX_DATA_POINTS = 1;

/**
 * Past this the interval is rarely the limiting factor anymore: a datasource's own minimum
 * interval (Prometheus `minStep`, the scrape interval) takes over, and on the logs side the
 * bucket count starts competing with OpenSearch's `search.max_buckets`.
 */
export const MAX_MAX_DATA_POINTS = 1000;

/**
 * Reads a panel spec's `maxDataPoints`. Anything a hand-edited dashboard JSON could hold — a
 * string, a fraction, a negative, 10^6 — resolves to `undefined`, which every caller reads as
 * "auto" and falls back to its own default.
 */
export function resolveMaxDataPoints(maxDataPoints: unknown): number | undefined {
  if (typeof maxDataPoints !== 'number' || !Number.isFinite(maxDataPoints)) {
    return undefined;
  }

  const wholePoints = Math.floor(maxDataPoints);

  return wholePoints < MIN_MAX_DATA_POINTS ? undefined : Math.min(wholePoints, MAX_MAX_DATA_POINTS);
}

/**
 * Parses what was typed into the editor field. An empty field and an unparseable one both mean
 * "auto", the same way Grafana treats a cleared field.
 */
export function parseMaxDataPointsInput(input: string): number | undefined {
  const trimmed = input.trim();

  return trimmed === '' ? undefined : resolveMaxDataPoints(Number(trimmed));
}
// LOGZ.IO CHANGE END:: Panel-level "Max data points" [APPZ-3369]
