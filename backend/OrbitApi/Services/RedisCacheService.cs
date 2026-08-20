using System;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace OrbitApi.Services
{
    /// <summary>
    /// IDistributedCache implementation providing resilient, JSON-serialized caching with logging and error suppression.
    /// </summary>
    public class RedisCacheService : ICacheService
    {
        private readonly IDistributedCache _cache;
        private readonly ILogger<RedisCacheService> _logger;
        private readonly JsonSerializerOptions _jsonOptions;

        /// <summary>
        /// Initializes a new instance of <see cref="RedisCacheService"/>.
        /// </summary>
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

        /// <summary>
        /// Gets a value from cache and deserializes it from JSON.
        /// </summary>
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

        /// <summary>
        /// Serializes an object to JSON and stores it in IDistributedCache with expiration settings.
        /// </summary>
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

        /// <summary>
        /// Removes a key from the distributed cache.
        /// </summary>
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

        /// <summary>
        /// Evicts keys matching the specified prefix.
        /// </summary>
        public async Task RemoveByPrefixAsync(string prefixKey)
        {
            await RemoveAsync(prefixKey);
        }
    }
}
