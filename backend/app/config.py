from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    app_name: str = 'MPLADS AI Monitoring'
    app_env: str = 'development'
    database_url: str = 'sqlite:///./mplads.db'
    upload_dir: str = str(BASE_DIR / 'uploads')
    retain_uploaded_files: bool = True
    max_upload_size_mb: int = 50
    max_upload_rows: int = 1_000_000
    max_upload_columns: int = 500
    cors_allowed_origins: str = 'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,http://localhost:4173,http://127.0.0.1:4173'
    rate_limit_enabled: bool = True
    login_rate_limit_per_minute: int = 5
    general_rate_limit_per_minute: int = 60
    expensive_rate_limit_per_minute: int = 10
    max_request_body_mb: int = 5
    hsts_enabled: bool = False
    pii_scan_enabled: bool = True
    pii_sample_size: int = 1000
    pii_masking_enabled: bool = True
    security_scan_enabled: bool = True
    security_monitoring_enabled: bool = True
    security_alert_dedup_window_seconds: int = 300
    # Demo workbooks remain available for explicit runs, but never mutate a
    # user's database during application startup unless opted in.
    demo_mode: bool = False
    demo_data_dir: str = str(BASE_DIR / 'demo_data')
    demo_dataset_label: str = 'Official MPLADS Works Register (Ministry of Statistics and Programme Implementation)'
    model_dir: str = str(BASE_DIR / 'trained_models')
    auth_secret: str = 'change-this-development-secret'
    auth_token_minutes: int = 30
    auth_allowed_email_domains: str = 'gov.in,nic.in'
    auth_demo_password: str = 'Demo@123'
    state_can_provision_users: bool = True
    sample_data_dir: str = str(BASE_DIR / 'sample_data')
    default_demo_files: tuple[str, ...] = (
        'Works Sanctioned.xlsx',
        'Works Completed.xlsx',
        'Expenditure on Completed and On-going Works as on Date.xlsx',
        'Allocated Limit for Honble MPs.xlsx',
        'Amount consented for Calamity.xlsx',
    )

    @property
    def allowed_email_domains(self) -> set[str]:
        return {item.strip().lower() for item in self.auth_allowed_email_domains.split(',') if item.strip()}

    @property
    def allowed_origins(self) -> list[str]:
        return [item.strip() for item in self.cors_allowed_origins.split(',') if item.strip()]

    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        extra='ignore',
        protected_namespaces=('settings_',),
    )


settings = Settings()
