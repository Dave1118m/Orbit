using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrbitApi.Services;

namespace OrbitApi.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class TranslationController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ICacheService _cache;

        public TranslationController(IHttpClientFactory httpClientFactory, ICacheService cache)
        {
            _httpClientFactory = httpClientFactory;
            _cache = cache;
        }

        public class TranslationRequest
        {
            public string Text { get; set; } = string.Empty;
            public string SourceLanguage { get; set; } = "en";
            public string TargetLanguage { get; set; } = "am";
        }

        public class BatchTranslationRequest
        {
            public List<string> Texts { get; set; } = new();
            public string SourceLanguage { get; set; } = "en";
            public string TargetLanguage { get; set; } = "am";
        }

        public class TranslationResult
        {
            public string OriginalText { get; set; } = string.Empty;
            public string TranslatedText { get; set; } = string.Empty;
            public bool FromCache { get; set; }
            public string TargetLanguage { get; set; } = "am";
        }

        private static string GetCacheKey(string text, string src, string tgt)
        {
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes($"{src}:{tgt}:{text.Trim()}"));
            var hash = Convert.ToHexString(bytes)[..16];
            return $"tr:{src}:{tgt}:{hash}";
        }

        /// <summary>
        /// Translates a single text string using Free MyMemory API with Redis Caching.
        /// </summary>
        [HttpPost("translate")]
        [AllowAnonymous]
        public async Task<ActionResult<TranslationResult>> Translate([FromBody] TranslationRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Text))
            {
                return Ok(new TranslationResult { OriginalText = req.Text, TranslatedText = req.Text, FromCache = true });
            }

            var src = string.IsNullOrWhiteSpace(req.SourceLanguage) ? "en" : req.SourceLanguage.ToLower();
            var tgt = string.IsNullOrWhiteSpace(req.TargetLanguage) ? "am" : req.TargetLanguage.ToLower();

            if (src == tgt)
            {
                return Ok(new TranslationResult { OriginalText = req.Text, TranslatedText = req.Text, FromCache = true, TargetLanguage = tgt });
            }

            var cacheKey = GetCacheKey(req.Text, src, tgt);
            var cachedVal = await _cache.GetAsync<string>(cacheKey);
            if (!string.IsNullOrEmpty(cachedVal))
            {
                return Ok(new TranslationResult
                {
                    OriginalText = req.Text,
                    TranslatedText = cachedVal,
                    FromCache = true,
                    TargetLanguage = tgt
                });
            }

            var translatedText = await PerformApiTranslationAsync(req.Text, src, tgt);

            if (!string.IsNullOrEmpty(translatedText))
            {
                await _cache.SetAsync(cacheKey, translatedText, TimeSpan.FromDays(30));
            }

            return Ok(new TranslationResult
            {
                OriginalText = req.Text,
                TranslatedText = string.IsNullOrEmpty(translatedText) ? req.Text : translatedText,
                FromCache = false,
                TargetLanguage = tgt
            });
        }

        /// <summary>
        /// Translates a batch of text strings efficiently.
        /// </summary>
        [HttpPost("translate-batch")]
        [AllowAnonymous]
        public async Task<ActionResult<List<TranslationResult>>> TranslateBatch([FromBody] BatchTranslationRequest req)
        {
            var src = string.IsNullOrWhiteSpace(req.SourceLanguage) ? "en" : req.SourceLanguage.ToLower();
            var tgt = string.IsNullOrWhiteSpace(req.TargetLanguage) ? "am" : req.TargetLanguage.ToLower();

            var results = new List<TranslationResult>();
            if (req.Texts == null || !req.Texts.Any()) return Ok(results);

            foreach (var rawText in req.Texts)
            {
                if (string.IsNullOrWhiteSpace(rawText) || src == tgt)
                {
                    results.Add(new TranslationResult { OriginalText = rawText, TranslatedText = rawText, FromCache = true, TargetLanguage = tgt });
                    continue;
                }

                var cacheKey = GetCacheKey(rawText, src, tgt);
                var cachedVal = await _cache.GetAsync<string>(cacheKey);
                if (!string.IsNullOrEmpty(cachedVal))
                {
                    results.Add(new TranslationResult { OriginalText = rawText, TranslatedText = cachedVal, FromCache = true, TargetLanguage = tgt });
                    continue;
                }

                var translated = await PerformApiTranslationAsync(rawText, src, tgt);
                if (!string.IsNullOrEmpty(translated))
                {
                    await _cache.SetAsync(cacheKey, translated, TimeSpan.FromDays(30));
                }

                results.Add(new TranslationResult
                {
                    OriginalText = rawText,
                    TranslatedText = string.IsNullOrEmpty(translated) ? rawText : translated,
                    FromCache = false,
                    TargetLanguage = tgt
                });
            }

            return Ok(results);
        }

        private async Task<string?> PerformApiTranslationAsync(string text, string src, string tgt)
        {
            try {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(5);

                var url = $"https://api.mymemory.translated.net/get?q={Uri.EscapeDataString(text)}&langpair={src}|{tgt}";
                var response = await client.GetAsync(url);
                if (!response.IsSuccessStatusCode) return null;

                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                if (doc.RootElement.TryGetProperty("responseData", out var respData) &&
                    respData.TryGetProperty("translatedText", out var transElem))
                {
                    var result = transElem.GetString();
                    return string.IsNullOrWhiteSpace(result) ? null : result.Trim();
                }
            }
            catch
            {
                // Fallback to null on network error
            }

            return null;
        }
    }
}
