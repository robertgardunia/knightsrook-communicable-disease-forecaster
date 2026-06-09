from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_user: str
    postgres_pass: str
    postgres_db: str
    postgres_host: str = "db"
    postgres_port: int = 5432

    api_key: str = ""

    copernicus_client_id: str = ""
    copernicus_client_secret: str = ""
    earthdata_token: str = ""
    iom_dtm_api_key: str = ""
    stac_catalog_url: str = "https://earth-search.aws.element84.com/v1"

    class Config:
        env_file = ".env"


settings = Settings()
