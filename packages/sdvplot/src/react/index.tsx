import { type ImgHTMLAttributes, type ReactElement, useEffect, useState } from "react";
import { type ColorOptions, palette } from "../colors.js";
import { type EspnHeadshotLeague, HEADSHOT_ASPECT, headshotUrl, loadGsis } from "../headshots.js";
import { getLeagueSync, loadLeague } from "../index-data.js";
import { type LogoUrlOptions, logoUrlSync } from "../marks.js";
import { type ResolveOptions, type Value, resolveSync } from "../resolve.js";
import type { HeadshotIdSystem, League, MarkType, TeamId, Variant } from "../types.js";

type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "height" | "width">;

export interface TeamLogoProps extends ImgProps {
  team: Value;
  league: League;
  season?: LogoUrlOptions["season"];
  variant?: Variant;
  markType?: MarkType;
  /** Rendered `height` in px; width is left unset so the browser keeps the aspect. */
  size?: number;
  /** Defaults to the team's name. */
  alt?: string;
}

/** Team logo `<img>`. Loads the league index on first use; renders nothing until resolved and for an unknown team. */
export function TeamLogo({
  team,
  league,
  season,
  variant,
  markType,
  size,
  alt,
  ...imgProps
}: TeamLogoProps): ReactElement | null {
  const [mark, setMark] = useState<{ src: string; name: string } | undefined>();
  useEffect(() => {
    let live = true;
    // One async body: any throw (bad league, bad variant, lookup error) becomes a rejection the .catch swallows.
    (async () => {
      await loadLeague(league);
      if (!live) return;
      const o: LogoUrlOptions = {};
      if (season !== undefined) o.season = season;
      if (variant !== undefined) o.variant = variant;
      if (markType !== undefined) o.markType = markType;
      const src = logoUrlSync(team, league, o);
      const id = resolveSync(team, league, { season });
      const name = getLeagueSync(league).teams.find((t) => t.team_id === id)?.name ?? "";
      setMark(src === undefined ? undefined : { src, name });
    })().catch(() => {
      if (live) setMark(undefined);
    });
    return () => {
      live = false;
    };
  }, [team, league, season, variant, markType]);
  if (mark === undefined) return null;
  // biome-ignore lint/a11y/useAltText: alt is always set (prop or team name); imgProps cannot carry it
  return <img src={mark.src} alt={alt ?? mark.name} height={size} {...imgProps} />;
}

/** `TeamLogo` with `markType="wordmark"`. */
export function Wordmark(props: Omit<TeamLogoProps, "markType">): ReactElement | null {
  return <TeamLogo {...props} markType="wordmark" />;
}

export interface HeadshotProps extends ImgProps {
  playerId: Value;
  league: EspnHeadshotLeague;
  idSystem?: HeadshotIdSystem;
  /** Height in px (default 60); width follows the 600:436 headshot aspect. */
  height?: number;
  /** Default `name`, then "Player headshot". `""` marks it decorative (the initials box is then `aria-hidden`). */
  alt?: string;
  /**
   * `"initials"`: when there is no headshot URL or the image fails to load, show up to three initials of `name` in a
   * box of the headshot's size (blazing-the-nets `main` `components/Headshot.tsx:15-29`). Default `"none"`: a failed
   * load leaves the `<img>`, and an id with no URL renders nothing.
   */
  fallback?: "none" | "initials";
  /** The player's name, for the initials and the default alt text. */
  name?: string;
}

/**
 * The first character of every space-separated word, up to three, as blazing-the-nets `main` does
 * (`Headshot.tsx:16-20`): suffixes and particles are words ("Brian Thomas Jr." is "BTJ"), "De'Von" is one word.
 */
const initialsOf = (name: string): string =>
  name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 3);

/** Player headshot `<img>`: sync for ESPN ids; gsis ids render once the gsis map has loaded. Renders nothing for an unknown/malformed id, or a league/idSystem `headshotUrl` rejects. */
export function Headshot({
  playerId,
  league,
  idSystem,
  height = 60,
  alt,
  fallback = "none",
  name,
  ...imgProps
}: HeadshotProps): ReactElement | null {
  const [, setGsisReady] = useState(false); // re-render once loadGsis resolves
  const [failed, setFailed] = useState<string | undefined>(); // the src that failed to load
  useEffect(() => {
    if (idSystem !== "gsis") return;
    let live = true;
    loadGsis().then(
      () => {
        if (live) setGsisReady(true);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [idSystem]);
  let src: string | undefined;
  try {
    src = headshotUrl(playerId, league, idSystem === undefined ? {} : { idSystem });
  } catch {
    src = undefined;
  }
  const label = alt ?? name ?? "Player headshot";
  const width = Math.round(height * HEADSHOT_ASPECT);
  if (src === undefined || (fallback === "initials" && src === failed)) {
    if (fallback !== "initials" || name === undefined) return null;
    return (
      <span
        {...(label === "" ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
        className={imgProps.className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width,
          height,
          background: "var(--sdv-line, #e2e2e2)",
          color: "var(--sdv-muted, #525252)",
          ...imgProps.style,
        }}
      >
        {initialsOf(name)}
      </span>
    );
  }
  const shown = src;
  return (
    // biome-ignore lint/a11y/useAltText: alt always defaults to a string; imgProps cannot carry it
    <img
      src={shown}
      alt={label}
      height={height}
      width={width}
      {...imgProps}
      onError={(e) => {
        setFailed(shown);
        imgProps.onError?.(e);
      }}
    />
  );
}

/** `{team: "#hex"}` for a league once loaded (`undefined` before); reloads when `league`/`which` change. */
export function useTeamColors(
  league: League,
  { which }: { which?: ColorOptions["which"] } = {},
): Record<string, string> | undefined {
  const [colors, setColors] = useState<Record<string, string> | undefined>();
  useEffect(() => {
    let live = true;
    setColors(undefined);
    palette(league, undefined, which === undefined ? {} : { which })
      .then((c) => {
        if (live) setColors(c);
      })
      .catch(() => {
        if (live) setColors(undefined);
      });
    return () => {
      live = false;
    };
  }, [league, which]);
  return colors;
}

/** Sync resolver `(value, opts?) => TeamId | undefined` once the league is loaded (`undefined` before); reloads when `league` changes. */
export function useResolve(
  league: League,
): ((value: Value, opts?: ResolveOptions) => TeamId | undefined) | undefined {
  const [ready, setReady] = useState<League | undefined>();
  useEffect(() => {
    let live = true;
    setReady(undefined);
    loadLeague(league)
      .then(() => {
        if (live) setReady(league);
      })
      .catch(() => {
        if (live) setReady(undefined);
      });
    return () => {
      live = false;
    };
  }, [league]);
  return ready === undefined ? undefined : (value, opts) => resolveSync(value, ready, opts);
}
