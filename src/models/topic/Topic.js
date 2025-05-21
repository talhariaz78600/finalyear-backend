const { Schema, model } = require('mongoose');

const topicSchema = Schema(
  {
    name: { type: String, required: true, unique: true, index: true },
    topicType: {
      type: String,
      enum: ['other', 'customer', 'vendor'],
      required: true
    },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false
  }
);
module.exports = model('Topic', topicSchema);