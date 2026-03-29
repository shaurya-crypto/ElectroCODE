const MAX_TOKENS_ESTIMATE = 8000; // Hard max constraint for context payload chars approx

/**
 * Orchestrates token-trimming safely 
 */
function prioritizeAndValidate(payload) {
  // Deep clone to safely manipulate
  const validated = JSON.parse(JSON.stringify(payload));
  
  // Rule 1: Always retain Critical Path (Hardware anomalies / device identity)
  // No trimming allowed here.

  // Rule 2: Size estimation (Basic string length approx)
  const roughLen = JSON.stringify(validated).length;
  
  if (roughLen > MAX_TOKENS_ESTIMATE) {
    // We must drop optional data to fit inside the limit
    
    // 1st cut: Optional Workspace graph / telemetry history logging
    if (validated.environment?.telemetry?.recent_logs) {
       // Keep only the last 15 lines of telemetry safely
       validated.environment.telemetry.recent_logs = validated.environment.telemetry.recent_logs.slice(-15);
    }
    
    // 2nd cut: Important Code buffer chunking
    if (JSON.stringify(validated).length > MAX_TOKENS_ESTIMATE && validated.environment?.workspace?.smart_buffer) {
       // The buffer itself is overflowing our limit
       const lines = validated.environment.workspace.smart_buffer.split('\n');
       validated.environment.workspace.smart_buffer = "/// CHUNKED TO SAVE TOKENS ///\n" + lines.slice(0, 50).join("\n");
    }
  }

  // Final Validation assertion
  if (!validated.environment.device.chip) {
    validated.environment.device.chip = "Unknown MCU (Fallback mode)";
  }

  return validated;
}

module.exports = {
  prioritizeAndValidate
};
