using System;

namespace OrbitApi.DTOs
{
    public class CreateUserRequest
    {
        public string Name { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Password { get; set; } = null!;
        public string? PreferredLanguage { get; set; }
    }

    public class LoginRequest
    {
        public string Email { get; set; } = null!;
        public string Password { get; set; } = null!;
    }

    public class UpdateUserRequest
    {
        public string? Name { get; set; }
        public string? PhotoUrl { get; set; }
        public string? PreferredLanguage { get; set; }
        public string? PhoneNumber { get; set; }
        public bool? MFAEnabled { get; set; }
        public byte[]? RowVersion { get; set; }
    }

    public class AuthResponse
    {
        public string Token { get; set; } = null!;
        public DateTime ExpiresAt { get; set; }
        public UserDto User { get; set; } = null!;
    }
}
