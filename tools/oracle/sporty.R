#!/usr/bin/env Rscript
# Writes fixtures/sporty/<sport>/<league>/layer_<k>.csv (x,y of each geom_polygon layer, in draw order), text_<k>.csv (each
# ggfittext layer: box centre x,y + label + angle; its own counter) + bbox_<range>.csv; for one league per sport, the same
# layers + texts + bbox_full.csv drawn in other units (units_<u>/) and translated (trans_10_-5/)
suppressPackageStartupMessages({ library(sportyR); library(ggplot2) })
# LF on every OS: a text-mode file on Windows gets CRLF, and parity.test.ts (which splits on LF) would keep the CR in the fill column.
write.csv <- function(x, file, ...) { con <- base::file(file, "wb"); on.exit(close(con)); utils::write.csv(x, con, ...) }
writeLines <- function(text, con) { f <- base::file(con, "wb"); on.exit(close(f)); base::writeLines(text, f) }
args <- commandArgs(trailingOnly = TRUE); sports <- if (length(args)) args else c("basketball", "hockey", "football")
root <- file.path(dirname(dirname(dirname(normalizePath(sub("--file=", "", grep("--file=", commandArgs(), value = TRUE)))))), "fixtures", "sporty")
geoms <- list(basketball = geom_basketball, hockey = geom_hockey, football = geom_football,
              soccer = geom_soccer, baseball = geom_baseball, tennis = geom_tennis,
              volleyball = geom_volleyball, curling = geom_curling, lacrosse = geom_lacrosse,
              softball = geom_softball)
# sportyR's exported accessor (2.3.0, #73), not its internal table
dims <- sapply(names(geoms), sportyR::get_surface_dimensions, simplify = FALSE)
# Gate (spec §7): the installed sportyR's data must equal the vendored JSON the TS specs are generated from. Every
# ported sport is checked (not only the requested ones) because VERSION records the sha256 of the whole file.
json <- file.path(dirname(dirname(root)), "packages", "sporty", "data", "surface-dimensions.json")
vendored <- jsonlite::fromJSON(json)
for (sport in union(sports, names(geoms))) {
  eq <- all.equal(dims[[sport]], vendored[[sport]])
  if (!isTRUE(eq)) stop(sprintf("installed sportyR %s: surface_dimensions$%s differs from %s; install the sportyR it was vendored from (or re-vendor) before regenerating fixtures:\n%s",
                                as.character(packageVersion("sportyR")), sport, json, paste(eq, collapse = "\n")), call. = FALSE)
}
ranges <- list(basketball = c("full", "in bounds only", "offense", "defense", "offensive key", "defensive paint"),
               hockey = c("full", "in bounds only", "offense", "defense", "nzone", "ozone", "dzone"),
               football = c("full", "in bounds only", "offense", "defense", "red zone", "offensive red zone", "defensive red zone"))
ranges$volleyball <- c("full", "in bounds only", "offense", "defense")
ranges$soccer <- c("full", "in bounds only", "offense", "defense", "offensive half pitch", "defensive half pitch")
# "receivicehalf" is sportyR's own spelling; the correct "receive half" is not in its switch (R maps it to full), so it gets no fixture
ranges$tennis <- c("full", "in bounds only", "serve", "receive", "receivicehalf", "receiving half")
ranges$baseball <- c("full", "infield")
ranges$curling <- c("full", "in bounds only", "house")
ranges$lacrosse <- c("full", "in bounds only", "offense", "defense")
ranges$softball <- c("full", "infield")
# Writes a built plot's polygon layers and ggfittext labels into dir; returns c(polygons, texts)
dump <- function(g, dir) {
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  # Clear this dir's earlier layer/text fixtures first: a layer that is now skipped (0 rows) or gone must not leave a stale
  # file behind, since parity.test.ts counts the layer_ files
  unlink(list.files(dir, pattern = "^(layer|text)_[0-9]+\\.csv$", full.names = TRUE))
  k <- 0; tk <- 0
  for (layer in g$layers) {
    if (inherits(layer$geom, "GeomFitText")) { # ggfittext label: box centre (from its xmin/xmax/ymin/ymax mapping), label, angle
      tk <- tk + 1
      box <- lapply(layer$mapping[c("xmin", "xmax", "ymin", "ymax")], rlang::eval_tidy, data = layer$data)
      df <- data.frame(x = (box$xmin + box$xmax) / 2, y = (box$ymin + box$ymax) / 2, label = layer$aes_params$label, angle = layer$aes_params$angle)
      write.csv(format(df, digits = 15), file.path(dir, sprintf("text_%03d.csv", tk)), row.names = FALSE, quote = FALSE)
      next
    }
    if (!inherits(layer$geom, "GeomPolygon")) next
    # A 0-row layer draws nothing (sportyR 2.3.0's goal fan returns an empty frame for fan-less lacrosse leagues);
    # sporty emits no feature for it, so it gets no fixture
    if (nrow(layer$data) == 0) next
    k <- k + 1
    df <- layer$data[, c("x", "y")]
    df$fill <- layer$aes_params$fill %||% NA
    write.csv(format(df, digits = 15), file.path(dir, sprintf("layer_%03d.csv", k)), row.names = FALSE, quote = FALSE)
  }
  c(k, tk)
}
bbox <- function(g, file) {
  lim <- g$coordinates$limits
  write.csv(data.frame(x0 = lim$x[1], y0 = lim$y[1], x1 = lim$x[2], y1 = lim$y[2]), file, row.names = FALSE)
}
# One league per sport for the unit and translation cases (sportyR #74 scales the whole plot once; #76 football numbers)
unit_league <- c(basketball = "nba", hockey = "nhl", football = "ncaa", soccer = "epl", baseball = "mlb", tennis = "atp",
                 volleyball = "fivb", curling = "wcf", lacrosse = "ncaaw", softball = "ncaa")
for (sport in sports) for (league in setdiff(names(dims[[sport]]), "custom")) {
  dir <- file.path(root, sport, gsub(" ", "_", league)); dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  n <- dump(geoms[[sport]](league = league), dir); k <- n[1]; tk <- n[2]
  if (identical(unname(unit_league[sport]), league)) {
    unit_arg <- grep("_units$", names(formals(geoms[[sport]])), value = TRUE)
    native <- tolower(dims[[sport]][[league]][[unit_arg]] %||% "ft")
    for (u in setdiff(c("m", "ft", "in"), native)) {
      gu <- do.call(geoms[[sport]], stats::setNames(list(league, u), c("league", unit_arg)))
      dump(gu, file.path(dir, paste0("units_", u))); bbox(gu, file.path(dir, paste0("units_", u), "bbox_full.csv"))
    }
    gt <- geoms[[sport]](league = league, x_trans = 10, y_trans = -5)
    dump(gt, file.path(dir, "trans_10_-5")); bbox(gt, file.path(dir, "trans_10_-5", "bbox_full.csv"))
  }
  for (r in ranges[[sport]]) {
    gr <- geoms[[sport]](league = league, display_range = r)
    lim <- gr$coordinates$limits
    write.csv(data.frame(x0 = lim$x[1], y0 = lim$y[1], x1 = lim$x[2], y1 = lim$y[2]), file.path(dir, sprintf("bbox_%s.csv", gsub(" ", "_", r))), row.names = FALSE)
  }
  # rotation + translation case
  gt <- geoms[[sport]](league = league, rotation = 90, x_trans = 10, y_trans = -5); lim <- gt$coordinates$limits
  write.csv(data.frame(x0 = lim$x[1], y0 = lim$y[1], x1 = lim$x[2], y1 = lim$y[2]), file.path(dir, "bbox_rot90_t10_-5.csv"), row.names = FALSE)
  cat(sprintf("%s/%s: %d polygon layers, %d text layers\n", sport, league, k, tk))
}
sha <- tryCatch(system2("git", c("-C", Sys.getenv("SPORTYR_REPO", "/mnt/sdv_repos/sportyR"), "rev-parse", "--short", "HEAD"), stdout = TRUE, stderr = FALSE)[1], error = function(e) NA_character_, warning = function(w) NA_character_)
if (is.na(sha) || !nzchar(sha)) sha <- "unknown"
desc <- packageDescription("sportyR")
json_sha <- if (requireNamespace("digest", quietly = TRUE)) digest::digest(file = json, algo = "sha256") else unname(tools::sha256sum(json))
writeLines(c(sprintf("sportyR %s (installed: %s, packaged %s)", desc$Version, desc$Repository %||% "local build", desc$Packaged %||% "unknown"),
             sprintf("sportyR-git %s", sha), sprintf("surface-dimensions-sha256 %s", json_sha), sprintf("R %s.%s", R.version$major, R.version$minor)),
           file.path(root, "VERSION"))
