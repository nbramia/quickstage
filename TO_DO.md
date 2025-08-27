* Clean URLs
**To implement clean URLs in the future:**
1. Update `WORKER_BASE_URL` in `config.ts`
2. All components automatically use the new URLs
3. No need to search and replace throughout the codebase

For detailed deployment instructions, see [VERSION_MANAGEMENT.md](apps/extension/VERSION_MANAGEMENT.md).

### Routing Configuration
### **Configuration System**
The system now uses a centralized configuration approach for easy maintenance and future improvements:

1. **Centralized URLs**: All URLs are defined in `apps/web/src/config.ts`
2. **Easy Clean URL Migration**: When you implement clean URLs, change only one value in the config
3. **Consistent Configuration**: All components use the same configuration source
4. **Future-Proof**: Easy to switch between Worker URLs and clean URLs

### **Current Routing Strategy**
The system currently uses a **direct Worker approach** for maximum reliability:

1. **Extension generates URLs**: Directly to `https://quickstage-worker.nbramia.workers.dev/s/abc123`
2. **No Pages routing**: Bypasses Cloudflare Pages routing complexity
3. **Direct Worker access**: Ensures 100% reliability for snapshot serving
4. **Simplified architecture**: Fewer moving parts, easier to maintain

**Future Clean URL Implementation**: When you're ready to implement clean URLs, simply update the `WORKER_BASE_URL` in `apps/web/src/config.ts` and all components will automatically use the new URLs.

This approach prioritizes functionality over URL aesthetics, ensuring staged prototypes always work reliably.

For detailed deployment instructions, see [VERSION_MANAGEMENT.md](apps/extension/VERSION_MANAGEMENT.md).