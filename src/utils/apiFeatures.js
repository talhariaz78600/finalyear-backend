const { TypeCheck } = require('./helpers');

class APIFeatures {
  constructor(query, queryString, Model) {
    this.query = query;
    this.queryString = queryString;
    this.Model = Model;
  }

  filter() {
    const fieldDataTypes = this.Model.schema.paths;
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];

    excludedFields.forEach((el) => delete queryObj[el]);
    // Filter for string fields with case-insensitive matching
    Object.keys(queryObj).forEach((key) => {
      if (!queryObj[key]) {
        delete queryObj[key];
      } else if (TypeCheck(queryObj[key]).isObject()) {
        queryObj[key] = JSON.parse(
          JSON.stringify(queryObj[key]).replace(
            /\b(gte|gt|lte|lt|eq|ne)\b/g,
            (match) => `$${match}`
          )
        );
      } else if (fieldDataTypes[key]?.instance === 'String') {
        queryObj[key] = {
          $regex: new RegExp(queryObj[key].replace(/([.*+?=^!:${}()|[\]/\\])/g, '\\$1'), 'i')
        };
      }
    });
    console.log(queryObj);
    this.query = this.query.find(queryObj);

    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }

    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.replace('password', '').split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }

    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}
module.exports = APIFeatures;
