const { Schema, model } = require('mongoose');

const subTopicSchema = Schema(
  {
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true },
    name: { type: String, required: true, unique: true, index: true },
    title: {
      type: String,
      required: true,
     
    },
    description: { type: String, required: false },
    isDeleted: { type: Boolean, default: false } // Soft delete
  },
  {
    timestamps: true,
    versionKey: false
  }
);
module.exports = model('Subtopic', subTopicSchema);