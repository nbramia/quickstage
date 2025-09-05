/**
 * Analytics Event Migration: Convert to Reverse Timestamps
 *
 * This script migrates existing analytics events from the old timestamp format
 * (evt_1725542400000_id) to the new reverse timestamp format (evt_8274457600000_id)
 * to enable chronological ordering in Cloudflare KV.
 */
// Constants matching analytics.ts
const MAX_TS = 10000000000000; // Fixed constant for consistent 13-digit inverted timestamps
const BATCH_SIZE = 50; // Conservative batch size to avoid API limits
const MAX_OPERATIONS_PER_INVOCATION = 800; // Stay well under 1000 limit
export class AnalyticsEventMigration {
    env;
    stats;
    operationCount = 0;
    constructor(env) {
        this.env = env;
        this.stats = {
            totalKeys: 0,
            processedKeys: 0,
            migratedEvents: 0,
            skippedEvents: 0,
            errorCount: 0,
            startTime: Date.now(),
            batchNumber: 1
        };
    }
    /**
     * Check if event key is already in new reverse timestamp format
     */
    isNewFormat(eventKey) {
        const keyParts = eventKey.replace('event:', '').split('_');
        if (keyParts.length >= 2 && keyParts[0] === 'evt' && keyParts[1]) {
            const timestamp = parseInt(keyParts[1]);
            const currentTime = Date.now();
            // New format timestamps are much larger (inverted)
            return timestamp > currentTime * 2;
        }
        return false;
    }
    /**
     * Generate new reverse timestamp event ID from existing event
     */
    generateNewEventId(originalTimestamp, randomId) {
        const invertedTimestamp = MAX_TS - originalTimestamp;
        return `evt_${invertedTimestamp}_${randomId}`;
    }
    /**
     * Extract timestamp and random ID from old format event key
     */
    parseOldEventKey(eventKey) {
        try {
            const keyParts = eventKey.replace('event:', '').split('_');
            if (keyParts.length >= 3 && keyParts[0] === 'evt' && keyParts[1]) {
                const timestamp = parseInt(keyParts[1]);
                const randomId = keyParts.slice(2).join('_'); // In case random ID contains underscores
                // Validate timestamp is in reasonable range (not inverted)
                const currentTime = Date.now();
                if (timestamp < currentTime * 2 && timestamp > 1600000000000) { // After 2020
                    return { timestamp, randomId };
                }
            }
            return null;
        }
        catch (e) {
            return null;
        }
    }
    /**
     * Migrate a single event from old to new format
     */
    async migrateEvent(eventKey, eventData) {
        try {
            // Parse the old key to extract timestamp and ID
            const parsedKey = this.parseOldEventKey(eventKey);
            if (!parsedKey) {
                console.log(`⚠️ Could not parse event key: ${eventKey}`);
                return false;
            }
            // Generate new key with reverse timestamp
            const newEventId = this.generateNewEventId(parsedKey.timestamp, parsedKey.randomId);
            const newEventKey = `event:${newEventId}`;
            // Update the event data with new ID
            const updatedEventData = {
                ...eventData,
                id: newEventId
            };
            // Store event with new key
            await this.env.KV_ANALYTICS.put(newEventKey, JSON.stringify(updatedEventData));
            this.operationCount++;
            console.log(`✅ Migrated: ${eventKey} → ${newEventKey} (timestamp: ${parsedKey.timestamp})`);
            // Delete old key after successful migration
            await this.env.KV_ANALYTICS.delete(eventKey);
            this.operationCount++;
            return true;
        }
        catch (error) {
            console.error(`❌ Failed to migrate event ${eventKey}:`, error);
            return false;
        }
    }
    /**
     * Process a batch of events for migration
     */
    async processBatch(keys) {
        console.log(`\n🔄 Processing batch ${this.stats.batchNumber} (${keys.length} keys)`);
        for (const key of keys) {
            if (this.operationCount >= MAX_OPERATIONS_PER_INVOCATION - 50) {
                console.log(`⚠️ Approaching operation limit, stopping batch processing`);
                break;
            }
            if (!key.name.startsWith('event:evt_')) {
                this.stats.skippedEvents++;
                continue;
            }
            // Skip if already in new format
            if (this.isNewFormat(key.name)) {
                console.log(`⏭️ Skipping already migrated event: ${key.name}`);
                this.stats.skippedEvents++;
                continue;
            }
            try {
                // Fetch the event data
                const eventRaw = await this.env.KV_ANALYTICS.get(key.name);
                this.operationCount++;
                if (!eventRaw) {
                    console.log(`⚠️ Event data not found for key: ${key.name}`);
                    this.stats.errorCount++;
                    continue;
                }
                const eventData = JSON.parse(eventRaw);
                // Migrate the event
                const success = await this.migrateEvent(key.name, eventData);
                if (success) {
                    this.stats.migratedEvents++;
                }
                else {
                    this.stats.errorCount++;
                }
            }
            catch (error) {
                console.error(`❌ Error processing event ${key.name}:`, error);
                this.stats.errorCount++;
            }
            this.stats.processedKeys++;
        }
        this.stats.batchNumber++;
    }
    /**
     * Execute the migration with progress tracking
     */
    async executeMigration(maxBatches) {
        console.log(`\n🚀 Starting Analytics Event Migration to Reverse Timestamps`);
        console.log(`📊 Batch size: ${BATCH_SIZE}, Max operations: ${MAX_OPERATIONS_PER_INVOCATION}`);
        if (maxBatches) {
            console.log(`⚠️ Test mode: Limited to ${maxBatches} batches`);
        }
        let cursor;
        let batchCount = 0;
        try {
            while (this.operationCount < MAX_OPERATIONS_PER_INVOCATION - 100) {
                if (maxBatches && batchCount >= maxBatches) {
                    console.log(`🛑 Reached test batch limit (${maxBatches})`);
                    break;
                }
                // List events from KV
                const listOptions = {
                    prefix: 'event:evt_',
                    limit: BATCH_SIZE
                };
                if (cursor) {
                    listOptions.cursor = cursor;
                }
                const list = await this.env.KV_ANALYTICS.list(listOptions);
                this.operationCount++;
                if (!list.keys || list.keys.length === 0) {
                    console.log(`✅ No more events to process`);
                    break;
                }
                this.stats.totalKeys += list.keys.length;
                // Process this batch
                await this.processBatch(list.keys);
                // Update cursor for next iteration
                cursor = list.cursor || undefined;
                batchCount++;
                // Check if we're done
                if (!list.list_complete) {
                    console.log(`📄 More events available, continuing...`);
                }
                else {
                    console.log(`✅ All events processed`);
                    break;
                }
                // Progress report
                const elapsed = Date.now() - this.stats.startTime;
                console.log(`📊 Progress: ${this.stats.processedKeys}/${this.stats.totalKeys} processed, ${this.stats.migratedEvents} migrated, ${this.stats.errorCount} errors (${elapsed}ms elapsed)`);
            }
        }
        catch (error) {
            console.error(`❌ Migration failed:`, error);
            throw error;
        }
        // Final report
        const finalElapsed = Date.now() - this.stats.startTime;
        console.log(`\n🎉 Migration Complete!`);
        console.log(`📊 Final Stats:`);
        console.log(`   • Total Keys Found: ${this.stats.totalKeys}`);
        console.log(`   • Keys Processed: ${this.stats.processedKeys}`);
        console.log(`   • Events Migrated: ${this.stats.migratedEvents}`);
        console.log(`   • Events Skipped: ${this.stats.skippedEvents}`);
        console.log(`   • Errors: ${this.stats.errorCount}`);
        console.log(`   • Operations Used: ${this.operationCount}/${MAX_OPERATIONS_PER_INVOCATION}`);
        console.log(`   • Time Elapsed: ${finalElapsed}ms`);
        console.log(`   • Batches Processed: ${this.stats.batchNumber - 1}`);
        return this.stats;
    }
    /**
     * Test migration on a small batch (for validation)
     */
    async testMigration() {
        console.log(`\n🧪 Running Test Migration (1 batch only)`);
        return this.executeMigration(1);
    }
}
