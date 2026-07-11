using Microsoft.AspNetCore.Identity;

namespace OrbitApi.Identity;

public class ApplicationUser : IdentityUser<int>
{
    public string? FullName { get; set; }
}
