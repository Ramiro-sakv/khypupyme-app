using System.Xml.Linq;
using Microsoft.AspNetCore.DataProtection.Repositories;
using Npgsql;

namespace KhypuPyme.Api.Hosting;

internal sealed class PilotKeyRing(string connectionString) : IXmlRepository
{
    public IReadOnlyCollection<XElement> GetAllElements()
    {
        using var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        using var command = new NpgsqlCommand("SELECT payload FROM khypupyme.pilot_key_ring ORDER BY name", connection);
        using var rows = command.ExecuteReader();
        var keys = new List<XElement>();
        while (rows.Read()) keys.Add(XElement.Parse(rows.GetString(0)));
        return keys;
    }

    public void StoreElement(XElement element, string friendlyName)
    {
        using var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        using var command = new NpgsqlCommand("INSERT INTO khypupyme.pilot_key_ring(name,payload) VALUES ($1,$2) ON CONFLICT DO NOTHING", connection);
        command.Parameters.AddWithValue(friendlyName);
        command.Parameters.AddWithValue(element.ToString(SaveOptions.DisableFormatting));
        command.ExecuteNonQuery();
    }
}
