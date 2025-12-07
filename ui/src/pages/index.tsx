export function HomePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Home</h1>
      <p className="mt-4 text-muted-foreground">Welcome to CCS Config Dashboard</p>
    </div>
  );
}

export function ApiPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">API Profiles</h1>
      <p className="mt-4 text-muted-foreground">Manage your API profiles (Phase 03)</p>
    </div>
  );
}

export function CliproxyPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">CLIProxy</h1>
      <p className="mt-4 text-muted-foreground">OAuth provider management (Phase 03)</p>
    </div>
  );
}

export function AccountsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Accounts</h1>
      <p className="mt-4 text-muted-foreground">Multi-account management (Phase 03)</p>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-4 text-muted-foreground">Configure profile settings (Phase 05)</p>
    </div>
  );
}

export function HealthPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Health</h1>
      <p className="mt-4 text-muted-foreground">System health dashboard (Phase 06)</p>
    </div>
  );
}

export function SharedPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Shared Data</h1>
      <p className="mt-4 text-muted-foreground">Commands, skills, agents viewer (Phase 07)</p>
    </div>
  );
}
