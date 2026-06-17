use std::path::Path;

use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

pub type DbPool = Pool<ConnectionManager<SqliteConnection>>;

const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

pub fn establish_pool(db_path: &Path) -> Result<DbPool, String> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let database_url = db_path.to_string_lossy().into_owned();
    let manager = ConnectionManager::<SqliteConnection>::new(database_url);
    let pool = Pool::builder()
        .max_size(4)
        .build(manager)
        .map_err(|e| e.to_string())?;

    pool.get()
        .map_err(|e| e.to_string())?
        .run_pending_migrations(MIGRATIONS)
        .map_err(|e| e.to_string())?;

    Ok(pool)
}

pub fn db_status(pool: &DbPool) -> Result<String, String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    diesel::sql_query("SELECT 1")
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;
    Ok("ok".into())
}
