# Genre & Tag Management Design

**Date:** 2026-06-24
**Project:** Moxic GameStore
**Status:** Approved

## Overview

Normalize Game.Genre (free-text string) and Game.Tags (comma-separated string) into separate Genre and Tag entities with many-to-many relationships to Game. Provide admin CRUD screens for managing genres/tags, replace free-text inputs in GameForm with multi-select controls, and seed common genres/tags.

## Data Model

### New Entities

`csharp
public class Genre
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class Tag
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
`

### Updated Game Entity

Replace:
- string Genre → ICollection<Genre> Genres
- string Tags → ICollection<Tag> Tags

`csharp
public class Game
{
    // ... existing fields unchanged ...
    // Remove:
    // public string Genre { get; set; }
    // public string Tags { get; set; }
    // Add:
    public ICollection<Genre> Genres { get; set; } = new List<Genre>();
    public ICollection<Tag> Tags { get; set; } = new List<Tag>();
}
`

### EF Core Join Tables

EF Core 10 handles many-to-many automatically (configured via HasMany().WithMany()). Generated tables:

- GameGenre — GameId (FK → Game), GenreId (FK → Genre)
- GameTag — GameId (FK → Game), TagId (FK → Tag)

### DbContext Configuration

`csharp
modelBuilder.Entity<Genre>(entity =>
{
    entity.HasKey(e => e.Id);
    entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
    entity.HasIndex(e => e.Name).IsUnique();
});

modelBuilder.Entity<Tag>(entity =>
{
    entity.HasKey(e => e.Id);
    entity.Property(e => e.Name).HasMaxLength(50).IsRequired();
    entity.HasIndex(e => e.Name).IsUnique();
});

// Game many-to-many
modelBuilder.Entity<Game>(entity =>
{
    entity.HasMany(e => e.Genres).WithMany().UsingEntity(j => j.ToTable("GameGenre"));
    entity.HasMany(e => e.Tags).WithMany().UsingEntity(j => j.ToTable("GameTag"));
});
`

### Migration Strategy

1. Create Genre and Tag tables
2. Data migration: parse existing Game.Genre and Game.Tags → upsert into Genre/Tag → insert into join tables
3. Drop Game.Genre and Game.Tags columns

## API Changes

### New Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET / POST | /api/admin/genres | List / Create genre |
| PUT / DELETE | /api/admin/genres/{id} | Update / Delete genre |
| GET / POST | /api/admin/tags | List / Create tag |
| PUT / DELETE | /api/admin/tags/{id} | Update / Delete tag |

### Updated Game DTOs

**CreateGameDto / UpdateGameDto:**
- Remove Genre (string) and Tags (string?)
- Add List<Guid> GenreIds and List<Guid> TagIds

**GameListItemDto / GameDetailDto / AdminGameListItem / AdminGameDetailResponse:**
- Remove Genre (string) and Tags (string)
- Add genre/tag list DTOs

### Public API

Update responses for GET /api/games, GET /api/games/{id}, GET /api/games/featured to return genre/tag lists.

## Seed Data

Genres: Action, Adventure, RPG, Simulation, Strategy, Sports, Racing, Horror, Shooter, Puzzle, Indie, Open World
Tags: Hot, Bestseller, Preorder, New, Coming Soon, Sale

## Admin UI (Moxic.Admin)

### New Pages
- **GenreList.tsx** — data table with inline add/edit, delete
- **TagList.tsx** — same pattern
- Sidebar navigation links for Genres + Tags

### Updated Pages
- **GameForm.tsx** — replace Genre input with multi-select (pills/dropdown), replace Tags input with multi-select. Fetch genres + tags as reference data on load. Send GenreIds / TagIds.
- **GameList.tsx** — display genre names and tag pills from resolved data

## Public UI (Moxic.Web)

Update game.ts types: replace genre: string / 	ags: string with genres: {id, name}[] / 	ags: {id, name}[]. Update GameCard rendering. Update seedData.ts mock data.

## Scope

In scope: entities, migration, admin API, admin UI management pages, GameForm multi-select, public UI type updates, seed data.
Out of scope: public search/filter by genre/tag, usage analytics, bulk import/export.
