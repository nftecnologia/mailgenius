const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('📦 Applying scalable upload system migration...');

    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/009_scalable_upload_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
    console.log('📋 Created tables:');
    console.log('   - file_upload_jobs');
    console.log('   - file_upload_chunks');
    console.log('   - processing_batches');
    console.log('   - upload_progress_events');
    console.log('   - temp_validation_data');
    console.log('');
    console.log('🔧 Created functions:');
    console.log('   - get_upload_job_progress()');
    console.log('   - cleanup_expired_uploads()');
    console.log('   - get_processing_stats()');
    console.log('');
    console.log('🔐 Applied RLS policies for all tables');
    console.log('');
    console.log('🚀 System is ready for scalable uploads!');

  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  applyMigration();
}

module.exports = { applyMigration };