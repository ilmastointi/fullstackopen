const blogsRouter = require("express").Router();
const Blog = require("../models/blog");

blogsRouter.get("/blogs", async (request, response) => {
  const blogs = await Blog.find({});
  response.json(blogs);
});

blogsRouter.post("/blogs", async (request, response) => {
  const content = new Blog(request.body);
  const parsedContent = JSON.parse(JSON.stringify(content));
  if (
    !parsedContent.hasOwnProperty("likes") ||
    (!parsedContent.hasOwnProperty("url") &&
      !parsedContent.hasOwnProperty("title"))
  ) {
    response.status(400).end();
  } else {
    const result = await content.save();
    response.status(201).json(result);
  }
});

module.exports = blogsRouter;
