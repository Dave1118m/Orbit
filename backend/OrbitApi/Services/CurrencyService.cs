using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace OrbitApi.Services
{
    /// <summary>
    /// Service contract for foreign currency exchange rate lookups and monetary conversion calculations.
    /// </summary>
    public interface ICurrencyService
    {
        /// <summary>
        /// Retrieves the real-time or cached exchange rate from a base currency to a target currency.
        /// </summary>
        /// <param name="fromCurrency">The ISO 3-letter source currency code (e.g. USD, EUR, ETB).</param>
        /// <param name="toCurrency">The ISO 3-letter target currency code.</param>
        /// <returns>The exchange rate multiplier.</returns>
        Task<decimal> GetExchangeRateAsync(string fromCurrency, string toCurrency);

        /// <summary>
        /// Converts a monetary amount from one currency to another using current rates.
        /// </summary>
        /// <param name="amount">The monetary amount in source currency.</param>
        /// <param name="fromCurrency">Source currency code.</param>
        /// <param name="toCurrency">Target currency code.</param>
        /// <returns>The converted monetary value in the target currency.</returns>
        Task<decimal> ConvertAsync(decimal amount, string fromCurrency, string toCurrency);
    }

    /// <summary>
    /// Currency service implementing live external rate lookups (ExchangeRate-API) with graceful offline fallbacks.
    /// </summary>
    public class CurrencyService : ICurrencyService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly ILogger<CurrencyService> _logger;

        /// <summary>
        /// Initializes a new instance of <see cref="CurrencyService"/>.
        /// </summary>
        public CurrencyService(IHttpClientFactory httpClientFactory, IConfiguration configuration, ILogger<CurrencyService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _logger = logger;
        }

        /// <summary>
        /// Fetches the exchange rate via HTTP from ExchangeRate-API; falls back to static default rates if API key is unconfigured or offline.
        /// </summary>
        public async Task<decimal> GetExchangeRateAsync(string fromCurrency, string toCurrency)
        {
            if (string.Equals(fromCurrency, toCurrency, StringComparison.OrdinalIgnoreCase))
                return 1.0m;

            try
            {
                var apiKey = _configuration["ExchangeRateApi:Key"];
                if (string.IsNullOrEmpty(apiKey))
                {
                    _logger.LogWarning("ExchangeRateApi:Key is missing. Falling back to hardcoded rate.");
                    return GetFallbackRate(fromCurrency, toCurrency);
                }

                var client = _httpClientFactory.CreateClient();
                var response = await client.GetAsync($"https://v6.exchangerate-api.com/v6/{apiKey}/latest/{fromCurrency.ToUpper()}");
                
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(content);
                    var root = doc.RootElement;
                    
                    if (root.TryGetProperty("conversion_rates", out var rates) &&
                        rates.TryGetProperty(toCurrency.ToUpper(), out var rateElement))
                    {
                        if (rateElement.TryGetDecimal(out var rate))
                        {
                            return rate;
                        }
                    }
                }
                
                _logger.LogWarning($"Failed to get exchange rate for {fromCurrency} to {toCurrency}. Falling back.");
                return GetFallbackRate(fromCurrency, toCurrency);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error fetching exchange rate from {fromCurrency} to {toCurrency}");
                return GetFallbackRate(fromCurrency, toCurrency);
            }
        }

        /// <summary>
        /// Converts an amount by multiplying it with the retrieved exchange rate.
        /// </summary>
        public async Task<decimal> ConvertAsync(decimal amount, string fromCurrency, string toCurrency)
        {
            if (amount == 0) return 0;
            var rate = await GetExchangeRateAsync(fromCurrency, toCurrency);
            return amount * rate;
        }

        /// <summary>
        /// Provides standard baseline fallback exchange rates when the third-party FX API is unreachable.
        /// </summary>
        private decimal GetFallbackRate(string fromCurrency, string toCurrency)
        {
            var from = fromCurrency.ToUpper();
            var to = toCurrency.ToUpper();
            
            if (from == "USD" && to == "ETB") return 130.0m;
            if (from == "ETB" && to == "USD") return 1m / 130.0m;
            if (from == "EUR" && to == "ETB") return 140.0m;
            if (from == "ETB" && to == "EUR") return 1m / 140.0m;
            if (from == "EUR" && to == "USD") return 1.1m;
            if (from == "USD" && to == "EUR") return 1m / 1.1m;
            
            return 1.0m;
        }
    }
}
