using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Api.Models;

namespace Moxic.Api.Controllers;

[Route("api/admin/genres")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminGenresController : ControllerBase
{
    private readonly MoxicDbContext _db;

    public AdminGenresController(MoxicDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var genres = await _db.Genres.OrderBy(g => g.Name).ToListAsync();
        return Ok(genres.Select(g => new GenreAdminDto(g.Id, g.Name)));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateGenreTagDto dto)
    {
        if (await _db.Genres.AnyAsync(g => g.Name == dto.Name))
            return Conflict(new { error = "Genre already exists" });

        var genre = new Genre { Id = Guid.NewGuid(), Name = dto.Name.Trim() };
        _db.Genres.Add(genre);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { id = genre.Id }, new GenreAdminDto(genre.Id, genre.Name));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreateGenreTagDto dto)
    {
        var genre = await _db.Genres.FindAsync(id);
        if (genre == null) return NotFound();

        if (await _db.Genres.AnyAsync(g => g.Name == dto.Name && g.Id != id))
            return Conflict(new { error = "Genre name already exists" });

        genre.Name = dto.Name.Trim();
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var genre = await _db.Genres.FindAsync(id);
        if (genre == null) return NotFound();

        if (await _db.Games.AnyAsync(g => g.Genres.Any(ge => ge.Id == id)))
            return Conflict(new { error = "Genre is in use by one or more games" });

        _db.Genres.Remove(genre);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

[Route("api/admin/tags")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminTagsController : ControllerBase
{
    private readonly MoxicDbContext _db;

    public AdminTagsController(MoxicDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var tags = await _db.Tags.OrderBy(t => t.Name).ToListAsync();
        return Ok(tags.Select(t => new TagAdminDto(t.Id, t.Name)));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateGenreTagDto dto)
    {
        if (await _db.Tags.AnyAsync(t => t.Name == dto.Name))
            return Conflict(new { error = "Tag already exists" });

        var tag = new Tag { Id = Guid.NewGuid(), Name = dto.Name.Trim() };
        _db.Tags.Add(tag);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { id = tag.Id }, new TagAdminDto(tag.Id, tag.Name));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreateGenreTagDto dto)
    {
        var tag = await _db.Tags.FindAsync(id);
        if (tag == null) return NotFound();

        if (await _db.Tags.AnyAsync(t => t.Name == dto.Name && t.Id != id))
            return Conflict(new { error = "Tag name already exists" });

        tag.Name = dto.Name.Trim();
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var tag = await _db.Tags.FindAsync(id);
        if (tag == null) return NotFound();

        if (await _db.Games.AnyAsync(g => g.Tags.Any(t => t.Id == id)))
            return Conflict(new { error = "Tag is in use by one or more games" });

        _db.Tags.Remove(tag);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record CreateGenreTagDto(string Name);
