---
phase: 04-admin-order-management
plan: 01
type: auto
wave: 1
subsystem: admin-api
tags: [fix, presigned-url, game-media, dto]
key-files:
  created: []
  modified:
    - API/Moxic.Core/Entities/GameMedia.cs
    - API/Moxic.Api/Models/Dtos.cs
    - API/Moxic.Api/Controllers/AdminGamesController.cs
metrics:
  tasks: 3
  completed: 3
  duration: ~5m
  blockers: 0
---

# Plan 01 Summary: Prior-Phase Fixes

## Completed Tasks

1. **Add [NotMapped] PresignedUrl to GameMedia entity** — Added System.ComponentModel.DataAnnotations.Schema import and `[NotMapped] public string? PresignedUrl { get; set; }` property. Matches PaymentConfig pattern.

2. **Extend DTOs with missing fields** — Added SystemRequirementDto, SystemRequirementDataDto, GameRatingDto records. Added IsFeatured, SystemRequirements, Ratings to CreateGameDto and UpdateGameDto. Added admin response DTOs: AdminGameListItem (with PrimaryImage), AdminGameDetailResponse (with Media + PresignedUrl), AdminGameMediaItem.

3. **Update AdminGamesController** — Updated CreateGame/UpdateGame to map IsFeatured, SystemRequirements, Ratings. Updated GetGames to return AdminGameListItem with primaryImage presigned URL. Updated GetGame to return AdminGameDetailResponse with presigned media URLs and mapped owned entities.

## Deviations

None — followed plan exactly.

## Self-Check

- [x] GameMedia has [NotMapped] PresignedUrl property
- [x] CreateGameDto includes IsFeatured, SystemRequirements, Ratings
- [x] UpdateGameDto includes IsFeatured, SystemRequirements, Ratings
- [x] GetGames returns AdminGameListItem with PrimaryImage
- [x] GetGame returns AdminGameDetailResponse with PresignedUrl per media
- [x] CreateGame/UpdateGame set IsFeatured, SystemRequirements, Ratings
- [x] dotnet build passes

## Self-Check: PASSED
