using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace OrbitApi.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Route("api/[controller]")]
    [Authorize]
    public class CurrencyController : ControllerBase
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _config;

        // Supported currencies restricted strictly to USD and ETB
        private static readonly HashSet<string> SupportedCurrencies = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "USD", "ETB"
        };

        // Fallback reference rates relative to USD (1 USD = 130.00 ETB)
        private static readonly Dictionary<string, decimal> FallbackRatesToUsd = new Dictionary<string, decimal>
        {
            { "USD", 1.0m },
            { "ETB", 130.00m }
        };

        public CurrencyController(IHttpClientFactory httpClientFactory, IConfiguration config)
        {
            _httpClient = httpClientFactory.CreateClient();
            _config = config;
        }

        /// <summary>
        /// Gets list of supported currencies (Strictly USD & ETB).
        /// </summary>
        [HttpGet("currencies")]
        [AllowAnonymous]
        public ActionResult GetSupportedCurrencies()
        {
            return Ok(new[]
            {
                new { code = "USD", name = "US Dollar ($)", symbol = "$" },
                new { code = "ETB", name = "Ethiopian Birr (ETB / Br)", symbol = "ETB" }
            });
        }

        /// <summary>
        /// Gets live exchange rates using Exchange API key (or open endpoint), restricted strictly to USD and ETB.
        /// </summary>
        [HttpGet("rates")]
        [AllowAnonymous]
        public async Task<ActionResult> GetExchangeRates([FromQuery] string baseCurrency = "USD")
        {
            baseCurrency = ValidateCurrency(baseCurrency);

            var apiKey = _config["ExchangeApi:ApiKey"];
            var baseUrl = _config["ExchangeApi:BaseUrl"] ?? "https://v6.exchangerate-api.com/v6";

            try
            {
                string requestUrl = !string.IsNullOrWhiteSpace(apiKey)
                    ? $"{baseUrl}/{apiKey}/latest/{baseCurrency}"
                    : $"https://open.er-api.com/v6/latest/{baseCurrency}";

                var response = await _httpClient.GetAsync(requestUrl);
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;

                    if (root.TryGetProperty("rates", out var ratesElement) || 
                        root.TryGetProperty("conversion_rates", out ratesElement))
                    {
                        var rates = JsonSerializer.Deserialize<Dictionary<string, decimal>>(ratesElement.GetRawText());
                        
                        var filteredRates = new Dictionary<string, decimal>();
                        foreach (var curr in SupportedCurrencies)
                        {
                            if (rates != null && rates.TryGetValue(curr, out var val))
                                filteredRates[curr] = val;
                            else if (FallbackRatesToUsd.TryGetValue(curr, out var fallbackVal))
                                filteredRates[curr] = fallbackVal;
                        }
                        return Ok(filteredRates);
                    }
                }
            }
            catch (Exception)
            {
                // Fallback offline rates
            }

            return Ok(GetFilteredFallbackRates(baseCurrency));
        }

        /// <summary>
        /// Converts currency between USD and ETB using exchange rate API or fallback.
        /// </summary>
        [HttpGet("convert")]
        [AllowAnonymous]
        public async Task<ActionResult<object>> ConvertCurrency(
            [FromQuery] decimal amount = 1m, 
            [FromQuery] string from = "USD", 
            [FromQuery] string to = "ETB")
        {
            from = ValidateCurrency(from);
            to = ValidateCurrency(to);

            if (from == to)
            {
                return Ok(new
                {
                    fromAmount = amount,
                    fromCurrency = from,
                    toAmount = amount,
                    toCurrency = to,
                    exchangeRate = 1.0m,
                    isLive = true
                });
            }

            decimal rate = 130.0m;
            bool isLive = false;

            var apiKey = _config["ExchangeApi:ApiKey"];
            var baseUrl = _config["ExchangeApi:BaseUrl"] ?? "https://v6.exchangerate-api.com/v6";

            try
            {
                string requestUrl = !string.IsNullOrWhiteSpace(apiKey)
                    ? $"{baseUrl}/{apiKey}/latest/{from}"
                    : $"https://open.er-api.com/v6/latest/{from}";

                var response = await _httpClient.GetAsync(requestUrl);
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;

                    if (root.TryGetProperty("rates", out var ratesElement) || 
                        root.TryGetProperty("conversion_rates", out ratesElement))
                    {
                        if (ratesElement.TryGetProperty(to, out var rateVal) && rateVal.TryGetDecimal(out var liveRate))
                        {
                            rate = liveRate;
                            isLive = true;
                        }
                    }
                }
            }
            catch (Exception)
            {
                if (from == "USD" && to == "ETB") rate = FallbackRatesToUsd["ETB"];
                else if (from == "ETB" && to == "USD") rate = 1.0m / FallbackRatesToUsd["ETB"];
            }

            decimal convertedAmount = amount * rate;

            return Ok(new
            {
                fromAmount = amount,
                fromCurrency = from,
                toAmount = decimal.Round(convertedAmount, 2),
                toCurrency = to,
                exchangeRate = decimal.Round(rate, 4),
                isLive = isLive
            });
        }

        private static string ValidateCurrency(string? code)
        {
            if (string.IsNullOrWhiteSpace(code)) return "USD";
            var upper = code.Trim().ToUpper();
            return SupportedCurrencies.Contains(upper) ? upper : "USD";
        }

        private static Dictionary<string, decimal> GetFilteredFallbackRates(string baseCurrency)
        {
            if (baseCurrency == "USD")
            {
                return new Dictionary<string, decimal>
                {
                    { "USD", 1.0m },
                    { "ETB", FallbackRatesToUsd["ETB"] }
                };
            }
            else
            {
                return new Dictionary<string, decimal>
                {
                    { "ETB", 1.0m },
                    { "USD", decimal.Round(1.0m / FallbackRatesToUsd["ETB"], 6) }
                };
            }
        }
    }
}
