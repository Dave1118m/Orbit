using OrbitApi.Models;

namespace OrbitApi.Authorization;

public sealed class ScopedResource
{
    public ScopeType ScopeType { get; }
    public int ScopeId { get; }

    public ScopedResource(ScopeType scopeType, int scopeId)
    {
        ScopeType = scopeType;
        ScopeId = scopeId;
    }
}
