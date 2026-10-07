#!/usr/bin/env Rscript
# Writes fixtures/sporty/<sport>/<league>/layer_<k>.csv (x,y of each geom_polygon layer, in draw order), text_<k>.csv (each
# ggfittext layer: box centre x,y + label + angle; its own counter) + bbox_<range>.csv
suppressPackageStartupMessages({ library(sportyR); library(ggplot2) })
# LF on every OS: a text-mode file on Windows gets CRLF, and parity.test.ts (which splits on LF) would keep the CR in the fill column.
write.csv <- function(x, file, ...) { con <- base::file(file, "wb"); on.exit(close(con)); utils::write.csv(x, con, ...) }
writeLines <- function(text, con) { f <- base::file(con, "wb"); on.exit(close(f)); base::writeLines(text, f) }
args <- commandArgs(trailingOnly = TRUE); sports <- if (length(args)) args else c("basketball", "hockey", "football")
root <- file.path(dirname(dirname(dirname(normalizePath(sub("--file=", "", grep("--file=", commandArgs(), value = TRUE)))))), "fixtures", "sporty")
geoms <- list(basketball = geom_basketball, hockey = geom_hockey, football = geom_football,
              soccer = geom_soccer, baseball = geom_baseball, tennis = geom_tennis,
              volleyball = geom_volleyball, curling = geom_curling, lacrosse = geom_lacrosse)
dims <- sportyR:::surface_dimensions
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
ranges$soccer <- c("full", "in bounds only", "offense", "defense", "offensive half pitch", "defensive half pitch")
for (sport in sports) for (league in setdiff(names(dims[[sport]]), "custom")) {
  dir <- file.path(root, sport, gsub(" ", "_", league)); dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  g <- geoms[[sport]](league = league)
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
    k <- k + 1
    df <- layer$data[, c("x", "y")]
    df$fill <- layer$aes_params$fill %||% NA
    write.csv(format(df, digits = 15), file.path(dir, sprintf("layer_%03d.csv", k)), row.names = FALSE, quote = FALSE)
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
