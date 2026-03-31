const mongoose = require('mongoose');

/**
 * Create indexes for optimal database performance
 * Run this on application startup
 */

const createProductionIndexes = async () => {
  try {
    console.log('📊 Creating database indexes for production...');

    // Message indexes - critical for chat performance
    const messageIndexes = [
      {
        name: 'idx_weekId_timestamp',
        spec: { weekId: 1, timestamp: -1 },
        options: { background: true },
      },
      {
        name: 'idx_userId_timestamp',
        spec: { userId: 1, timestamp: -1 },
        options: { background: true },
      },
      {
        name: 'idx_weekId_isDeleted',
        spec: { weekId: 1, isDeleted: 1 },
        options: { background: true },
      },
      {
        name: 'idx_repliedTo',
        spec: { repliedTo: 1 },
        options: { sparse: true, background: true },
      },
    ];

    // Resource indexes - for fast retrieval of course materials
    const resourceIndexes = [
      {
        name: 'idx_courseId_weekId_type',
        spec: { courseId: 1, weekId: 1, type: 1 },
        options: { background: true },
      },
      {
        name: 'idx_courseId_isPublished',
        spec: { courseId: 1, isPublished: 1 },
        options: { background: true },
      },
      {
        name: 'idx_createDate',
        spec: { createdAt: -1 },
        options: { background: true },
      },
    ];

    // User indexes - for authentication and profile lookups
    const userIndexes = [
      {
        name: 'idx_email_unique',
        spec: { email: 1 },
        options: { unique: true, sparse: true, background: true },
      },
      {
        name: 'idx_username_unique',
        spec: { username: 1 },
        options: { unique: true, sparse: true, background: true },
      },
      {
        name: 'idx_role',
        spec: { role: 1 },
        options: { background: true },
      },
    ];

    // Week indexes - for course navigation
    const weekIndexes = [
      {
        name: 'idx_courseId_weekNumber',
        spec: { courseId: 1, weekNumber: 1 },
        options: { unique: true, background: true },
      },
      {
        name: 'idx_yearInstanceId',
        spec: { yearInstanceId: 1 },
        options: { background: true },
      },
    ];

    // Course indexes - for discovery and filtering
    const courseIndexes = [
      {
        name: 'idx_subject_isPublished',
        spec: { subject: 1, isPublished: 1 },
        options: { background: true },
      },
      {
        name: 'idx_noc_code_unique',
        spec: { nocCode: 1 },
        options: { unique: true, sparse: true, background: true },
      },
    ];

    // Create indexes for each collection
    const indexMap = {
      Message: messageIndexes,
      Resource: resourceIndexes,
      User: userIndexes,
      Week: weekIndexes,
      Course: courseIndexes,
    };

    for (const [modelName, indexes] of Object.entries(indexMap)) {
      try {
        const model = mongoose.model(modelName);
        
        for (const { name, spec, options } of indexes) {
          await model.collection.createIndex(spec, {
            name,
            ...options,
          });
          console.log(`✓ Created index: ${modelName}.${name}`);
        }
      } catch (error) {
        // Index already exists or other issue
        if (!error.message.includes('already exists')) {
          console.warn(`⚠ Could not create index for ${modelName}:`, error.message);
        }
      }
    }

    // Create compound indexes for complex queries
    await createCompoundIndexes();

    console.log('✓ Database indexes created successfully');
  } catch (error) {
    console.error('✗ Error creating indexes:', error);
    throw error;
  }
};

/**
 * Create specialized compound indexes for complex queries
 */
const createCompoundIndexes = async () => {
  try {
    const Message = mongoose.model('Message');
    const Resource = mongoose.model('Resource');

    // Index for thread queries (message + repliedTo)
    await Message.collection.createIndex(
      { weekId: 1, repliedTo: 1, timestamp: -1 },
      { name: 'idx_thread_query', background: true }
    );

    // Index for pagination queries
    await Message.collection.createIndex(
      { weekId: 1, timestamp: -1, _id: 1 },
      { name: 'idx_pagination', background: true }
    );

    // Index for resource search
    await Resource.collection.createIndex(
      { courseId: 1, weekId: 1, type: 1, title: 'text' },
      { name: 'idx_resource_search', background: true }
    );

    console.log('✓ Compound indexes created successfully');
  } catch (error) {
    if (!error.message.includes('already exists')) {
      console.warn('⚠ Compound indexes:', error.message);
    }
  }
};

/**
 * Get index statistics
 * Useful for monitoring index usage and performance
 */
const getIndexStats = async (modelName) => {
  try {
    const model = mongoose.model(modelName);
    const stats = await model.collection.getIndexes();
    return stats;
  } catch (error) {
    console.error(`Error getting index stats for ${modelName}:`, error);
    return null;
  }
};

/**
 * Drop unused indexes
 * Use carefully in production
 */
const dropIndex = async (modelName, indexName) => {
  try {
    const model = mongoose.model(modelName);
    await model.collection.dropIndex(indexName);
    console.log(`✓ Dropped index: ${modelName}.${indexName}`);
  } catch (error) {
    console.error(`Error dropping index:`, error);
    throw error;
  }
};

module.exports = {
  createProductionIndexes,
  createCompoundIndexes,
  getIndexStats,
  dropIndex,
};
