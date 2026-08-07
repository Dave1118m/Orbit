using System;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace OrbitApi.Services
{
    public class RedisCacheService : ICacheService
    {
        private readonly IDistributedCache _cache;
        private readonly ILogger<RedisCacheService> _logger;
        private readonly JsonSerializerOptions _jsonOptions;

        public RedisCacheService(IDistributedCache cache, ILogger<RedisCacheService> logger)
        {
            _cache = cache;
            _logger = logger;
            _jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles
            };
        }

        public async Task<T?> GetAsync<T>(string key)
        {
            try
            {
                var cachedString = await _cache.GetStringAsync(key);
                if (!string.IsNullOrEmpty(cachedString))
                {
                    return JsonSerializer.Deserialize<T>(cachedString, _jsonOptions);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to fetch from Redis cache for key: {Key}", key);
            }
            
            return default;
        }

        public async Task SetAsync<T>(string key, T value, TimeSpan? absoluteExpireTime = null, TimeSpan? slidingExpireTime = null)
        {
            try
            {
                var options = new DistributedCacheEntryOptions();
                
                if (absoluteExpireTime.HasValue)
                    options.AbsoluteExpirationRelativeToNow = absoluteExpireTime.Value;
                
                if (slidingExpireTime.HasValue)
                    options.SlidingExpiration = slidingExpireTime.Value;
                
                // Provide a default absolute expiration if neither is set
                if (!absoluteExpireTime.HasValue && !slidingExpireTime.HasValue)
                    options.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);

                var jsonString = JsonSerializer.Serialize(value, _jsonOptions);
                await _cache.SetStringAsync(key, jsonString, options);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to set Redis cache for key: {Key}", key);
            }
        }

        public async Task RemoveAsync(string key)
        {
            try
            {
                await _cache.RemoveAsync(key);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to remove from Redis cache for key: {Key}", key);
            }
        }

        public async Task RemoveByPrefixAsync(string prefixKey)
        {
            // Note: Standard IDistributedCache doesn't natively support wildcards.
            // For production, consider using StackExchange.Redis ConnectionMultiplexer directly to run `KEYS pattern`
            // and delete matching keys, OR use a tagging strategy in code.
            // For now, this acts as a placeholder / fallback for explicit exact keys.
            await RemoveAsync(prefixKey);
        }
    }
}
