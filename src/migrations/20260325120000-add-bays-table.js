module.exports = {
  async up(dbService) {
    // Add bay_ids to submissions to track which bays belong to a submission.
    await dbService.query(`
      ALTER TABLE submissions
      ADD COLUMN bay_ids JSON NULL
    `);

    // Create bays table storing uploads belonging to each bay.
    await dbService.query(`
      CREATE TABLE IF NOT EXISTS bays (
        id CHAR(36) PRIMARY KEY,
        upload_ids JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  },

  async down(dbService) {
    await dbService.query(`
      DROP TABLE IF EXISTS bays
    `);

    await dbService.query(`
      ALTER TABLE submissions
      DROP COLUMN bay_ids
    `);
  },
};

