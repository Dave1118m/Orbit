using System;
using System.Threading.Tasks;

namespace OrbitApi.Services
{
    /// <summary>
    /// Contract for distributed and in-memory caching operations with JSON serialization support.
    /// </summary>
    public interface ICacheService
    {
        /// <summary>
        /// Retrieves and deserializes a cached object by its key.
        /// </summary>
        /// <typeparam name="T">The target entity or value type.</typeparam>
        /// <param name="key">The cache key string.</param>
        /// <returns>The deserialized value or default if absent/expired.</returns>
        Task<T?> GetAsync<T>(string key);

        /// <summary>
        /// Serializes and stores an object in the cache with configurable expiration policies.
        /// </summary>
        /// <typeparam name="T">The value type.</typeparam>
        /// <param name="key">The cache key string.</param>
        /// <param name="value">The object payload to store.</param>
        /// <param name="absoluteExpireTime">Optional absolute duration from now before expiration.</param>
        /// <param name="slidingExpireTime">Optional sliding inactivity expiration window.</param>
        Task SetAsync<T>(string key, T value, TimeSpan? absoluteExpireTime = null, TimeSpan? slidingExpireTime = null);

        /// <summary>
        /// Evicts a specific key from the cache.
        /// </summary>
        /// <param name="key">The cache key string to remove.</param>
        Task RemoveAsync(string key);

        /// <summary>
        /// Evicts cache entries matching a specified key prefix.
        /// </summary>
        /// <param name="prefixKey">The prefix string.</param>
        Task RemoveByPrefixAsync(string prefixKey);
    }
}
