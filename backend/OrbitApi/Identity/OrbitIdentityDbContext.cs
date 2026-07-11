using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace OrbitApi.Identity;

public class OrbitIdentityDbContext : IdentityDbContext<ApplicationUser, IdentityRole<int>, int>
{
    public OrbitIdentityDbContext(DbContextOptions<OrbitIdentityDbContext> options) : base(options) { }
}
