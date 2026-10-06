import { type ImgHTMLAttributes, type ReactElement, useEffect, useState } from "react";
import { type ColorOptions, palette } from "../colors.js";
import { HEADSHOT_ASPECT, headshotUrl } from "../headshots.js";
import { getLeagueSync, loadLeague } from "../index-data.js";
import { type LogoUrlOptions, logoUrlSync } from "../marks.js";
import { type Value, resolveSync } from "../resolve.js";
import type { HeadshotIdSystem, League, MarkType, Variant } from "../types.js";

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
    loadLeague(league)
      .then(() => {
        if (!live) return;
        const o: LogoUrlOptions = {};
        if (season !== undefined) o.season = season;
        if (variant !== undefined) o.variant = variant;
        if (markType !== undefined) o.markType = markType;
        const src = logoUrlSync(team, league, o);
        const id = resolveSync(team, league, { season });
        const name = getLeagueSync(league).teams.find((t) => t.team_id === id)?.name ?? "";
        setMark(src === undefined ? undefined : { src, name });
      })
      .catch(() => {
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
  league: League;
  idSystem?: HeadshotIdSystem;
  /** Height in px (default 60); width follows the 600:436 headshot aspect. */
  height?: number;
  alt?: string;
}

/** Player headshot `<img>` (sync). Renders nothing for an unknown/malformed id. */
export function Headshot({
  playerId,
  league,
  idSystem,
  height = 60,
  alt = "Player headshot",
  ...imgProps
}: HeadshotProps): ReactElement | null {
  const src = headshotUrl(playerId, league, idSystem === undefined ? {} : { idSystem });
  if (src === undefined) return null;
  return (
    // biome-ignore lint/a11y/useAltText: alt always defaults to a string; imgProps cannot carry it
    <img src={src} alt={alt} height={height} width={Math.round(height * HEADSHOT_ASPECT)} {...imgProps} />
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
