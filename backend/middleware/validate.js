function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      });
    }
    req[source] = result.data;
    next();
  };
}

module.exports = validate;