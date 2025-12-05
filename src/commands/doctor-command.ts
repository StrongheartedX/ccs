/**
 * Doctor Command Handler
 *
 * Handle doctor command for CCS.
 */

/**
 * Handle doctor command
 * @param shouldFix - If true, attempt to fix detected issues
 */
export async function handleDoctorCommand(shouldFix = false): Promise<void> {
  const DoctorModule = await import('../management/doctor');
  const Doctor = DoctorModule.default;
  const doctor = new Doctor();

  await doctor.runAllChecks();

  // Attempt to fix issues if --fix flag provided
  if (shouldFix) {
    await doctor.fixIssues();
  }

  // Exit with error code if unhealthy
  process.exit(doctor.isHealthy() ? 0 : 1);
}
