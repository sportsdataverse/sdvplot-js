#!/usr/bin/env Rscript
# Writes fixtures/sporty/<sport>/<league>/layer_<k>.csv (x,y of each geom_polygon layer, in draw order) + bbox_<range>.csv
suppressPackageStartupMessages({ library(sportyR); library(ggplot2) })
args <- commandArgs(trailingOnly = TRUE); sports <- if (length(args)) args else c("basketball", "hockey", "football")
root <- file.path(dirname(dirname(dirname(normalizePath(sub("--file=", "", grep("--file=", commandArgs(), value = TRUE)))))), "fixtures", "sporty")
geoms <- list(basketball = geom_basketball, hockey = geom_hockey, football = geom_football)
dims <- sportyR:::surface_dimensions
ranges <- list(basketball = c("full", "in bounds only", "offense", "defense", "offensive key", "defensive paint"),
               hockey = c("full", "in bounds only", "offense", "defense", "nzone", "ozone", "dzone"),
               football = c("full", "in bounds only", "offense", "defense", "red zone", "offensive red zone", "defensive red zone"))
for (sport in sports) for (league in setdiff(names(dims[[sport]]), "custom")) {
  dir <- file.path(root, sport, gsub(" ", "_", league)); dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  g <- geoms[[sport]](league = league)
  k <- 0
  for (layer in g$layers) {
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
  cat(sprintf("%s/%s: %d polygon layers\n", sport, league, k))
}
sha <- tryCatch(system2("git", c("-C", Sys.getenv("SPORTYR_REPO", "/mnt/sdv_repos/sportyR"), "rev-parse", "--short", "HEAD"), stdout = TRUE, stderr = FALSE)[1], error = function(e) NA_character_, warning = function(w) NA_character_)
if (is.na(sha) || !nzchar(sha)) sha <- "unknown"
writeLines(c(sprintf("sportyR %s", as.character(packageVersion("sportyR"))), sprintf("sportyR-git %s", sha), sprintf("R %s.%s", R.version$major, R.version$minor)), file.path(root, "VERSION"))
