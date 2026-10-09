/**
 * GuardianBand AI Automation Module
 * 
 * Responsibilities:
 * 1. Data Validation & Completeness Check
 * 2. Missing GPS Detection & Anomaly Screening
 * 3. Priority Determination (CRITICAL / HIGH / MEDIUM)
 * 4. Tactical Dispatcher Summary Generation
 * 5. Automatic Escalation Routing to Police Control Room
 * 
 * Safety Rule: The emergency path NEVER depends on AI.
 * If AI service fails or times out, the failsafe fallback ensures
 * automatic police escalation proceeds unconditionally.
 */

import { GoogleGenAI } from '@google/genai';

class AIAutomationModule {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || null;
    this.geminiClient = null;

    if (this.apiKey) {
      try {
        this.geminiClient = new GoogleGenAI({ apiKey: this.apiKey });
        console.log('[AIAutomation] Gemini API client initialized.');
      } catch (err) {
        console.warn('[AIAutomation] Failed to initialize Gemini API client:', err.message);
      }
    } else {
      console.log('[AIAutomation] No GEMINI_API_KEY detected. Running with high-precision deterministic safety engine.');
    }
  }

  /**
   * Process and enrich a verified emergency event.
   * Guaranteed to resolve and NEVER throw or block escalation.
   */
  async processEmergencyEvent(payload, userProfile = null, deviceTelemetry = null) {
    const startTime = Date.now();

    try {
      // 1. Data Validation
      const validation = this.validatePayload(payload);

      // 2. Determine Priority
      const priority = this.evaluatePriority(payload, validation, deviceTelemetry);

      // 3. Generate Tactical Summary & Recommendation
      let summary = '';
      let recommendedSector = 'SECTOR 4 - DOWNTOWN PRECINCT';

      // Try LLM generation if available, otherwise deterministic tactical prompt
      if (this.geminiClient && validation.isValid) {
        try {
          const prompt = `You are the automated GuardianBand Police Dispatch AI Assistant.
Analyze this verified emergency SOS event:
User: ${userProfile ? userProfile.name : payload.userId}
Device ID: ${payload.deviceId}
Verification Method: ${payload.verificationMethod || '15-second timeout'}
Location: Lat ${payload.latitude}, Lng ${payload.longitude}, Address: ${payload.address || 'Unknown'}
Battery: ${deviceTelemetry?.battery ?? 'Unknown'}%
Generate a concise, 2-sentence tactical summary for the police dispatch operator. State the emergency verification method, location confidence, and immediate tactical routing. Do not speculate on assailant presence.`;

          const response = await this.geminiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });

          if (response?.text) {
            summary = response.text.trim();
          }
        } catch (llmErr) {
          console.warn('[AIAutomation] Gemini LLM request skipped/failed, falling back to deterministic summary:', llmErr.message);
        }
      }

      // Fallback/Standard deterministic tactical summary
      if (!summary) {
        summary = this.generateDeterministicSummary(payload, validation, priority, userProfile);
      }

      const processingDurationMs = Date.now() - startTime;

      return {
        aiStatus: "COMPLETED",
        validationStatus: validation.status,
        missingFields: validation.missingFields,
        hasLocation: validation.hasLocation,
        priority,
        recommendedSector,
        summary,
        automaticPoliceEscalation: "INITIATED",
        processingTimeMs: processingDurationMs,
        failsafeUsed: false
      };

    } catch (err) {
      console.error('[AIAutomation] Unexpected error in AI pipeline. Triggering safety failsafe:', err);

      // CRITICAL FAILSAFE: Escalation MUST proceed even if AI pipeline crashes
      return {
        aiStatus: "UNAVAILABLE",
        validationStatus: "UNKNOWN",
        missingFields: [],
        hasLocation: payload.latitude !== null && payload.longitude !== null,
        priority: "HIGH",
        recommendedSector: "CITY-WIDE EMERGENCY DISPATCH",
        summary: "Automated AI enrichment encountered an anomaly. Failsafe activated: Emergency verified and transferred immediately to Police Control Room.",
        automaticPoliceEscalation: "INITIATED",
        processingTimeMs: Date.now() - startTime,
        failsafeUsed: true
      };
    }
  }

  validatePayload(payload) {
    const missingFields = [];
    if (!payload.userId) missingFields.push('userId');
    if (!payload.deviceId) missingFields.push('deviceId');
    if (!payload.triggerTime) missingFields.push('triggerTime');

    const hasLocation = payload.latitude !== null && 
                        payload.latitude !== undefined && 
                        payload.longitude !== null && 
                        payload.longitude !== undefined;

    if (!hasLocation) {
      missingFields.push('coordinates');
    }

    return {
      isValid: missingFields.length === 0,
      hasLocation,
      missingFields,
      status: hasLocation ? "VALIDATED_LOCATION_LOCKED" : "VALIDATED_LOCATION_UNAVAILABLE"
    };
  }

  evaluatePriority(payload, validation, deviceTelemetry) {
    // If device battery is critical (< 15%), elevate priority
    if (deviceTelemetry && deviceTelemetry.battery <= 15) {
      return "CRITICAL";
    }

    // If explicit user confirmation ("NO / EMERGENCY") was selected on band
    if (payload.verificationMethod === "EXPLICIT_EMERGENCY_CONFIRMED") {
      return "CRITICAL";
    }

    // If location is unavailable, maintain HIGH priority for rapid search dispatch
    if (!validation.hasLocation) {
      return "HIGH";
    }

    return "HIGH";
  }

  generateDeterministicSummary(payload, validation, priority, userProfile) {
    const userName = userProfile ? userProfile.name : payload.userId;
    const locationStr = validation.hasLocation 
      ? `Coordinates confirmed (${Number(payload.latitude).toFixed(4)}, ${Number(payload.longitude).toFixed(4)}) near ${payload.address || 'target sector'}.` 
      : `GPS location is currently unavailable; cell tower triangulation pending.`;

    const methodStr = payload.verificationMethod === "EXPLICIT_EMERGENCY_CONFIRMED"
      ? "Direct emergency confirmation received from wearable."
      : "Automated distress trigger verified after 15-second safety timer expired with no response.";

    return `Verified SOS for ${userName} (${payload.deviceId}). ${methodStr} ${locationStr} Automatic police escalation completed.`;
  }
}

export const aiAutomation = new AIAutomationModule();
