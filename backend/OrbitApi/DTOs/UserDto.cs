using System;
using System.Collections.Generic;

namespace OrbitApi.DTOs
{
    public class UserDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string? PhotoUrl { get; set; }
        public bool MFAEnabled { get; set; }
        public string? PreferredLanguage { get; set; }
        public string? PhoneNumber { get; set; }
        public byte[]? RowVersion { get; set; }
    }
}
