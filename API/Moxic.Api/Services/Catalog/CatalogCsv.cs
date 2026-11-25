using System.Text;

namespace Moxic.Api.Services.Catalog;

/// <summary>CSV for game import: a downloadable template and a small RFC-4180 parser (quotes, "" escapes, ',' or ';').</summary>
public static class CatalogCsv
{
    public static readonly string[] Columns =
        { "xbox_product_id", "ten_game", "mo_ta", "gia_goc", "gia_ban", "trang_thai", "ngay_ra_mat", "nha_phat_hanh", "the_loai", "vung", "link_anh" };

    /// <summary>UTF-8 BOM (so Excel shows Vietnamese), header and two example rows.</summary>
    public static string Template() =>
        "﻿" + string.Join(",", Columns) + "\r\n" +
        "9N431PX143P8,,,,,,,,,,\r\n" +
        ",Tên game ví dụ,\"Mô tả ngắn, có thể có dấu phẩy\",1499000,1049000,Available,2026-05-19,Xbox Game Studios,Đua xe|Thế giới mở,Global,https://example.com/anh.jpg\r\n";

    public static List<string[]> Parse(string text)
    {
        if (text.StartsWith('﻿')) text = text[1..];
        var firstLine = text.Split('\n', 2)[0];
        var sep = firstLine.Count(c => c == ';') > firstLine.Count(c => c == ',') ? ';' : ',';
        var rows = new List<string[]>();
        var row = new List<string>();
        var cell = new StringBuilder();
        var quoted = false;
        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (quoted)
            {
                if (c == '"' && i + 1 < text.Length && text[i + 1] == '"') { cell.Append('"'); i++; }
                else if (c == '"') quoted = false;
                else cell.Append(c);
            }
            else if (c == '"') quoted = true;
            else if (c == sep) { row.Add(cell.ToString()); cell.Clear(); }
            else if (c == '\n' || c == '\r')
            {
                if (c == '\r' && i + 1 < text.Length && text[i + 1] == '\n') i++;
                row.Add(cell.ToString());
                cell.Clear();
                rows.Add(row.ToArray());
                row = new List<string>();
            }
            else cell.Append(c);
        }
        if (cell.Length > 0 || row.Count > 0) { row.Add(cell.ToString()); rows.Add(row.ToArray()); }
        return rows;
    }
}
