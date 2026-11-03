namespace Moxic.Core.Entities;

/// <summary>Background music for the case-opening page ("Kho nhạc").</summary>
public class SpinMusicTrack
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ObjectKey { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}
