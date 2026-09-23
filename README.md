# Homepage

A minimal site built with [Eleventy](https://www.11ty.dev/). Pages are written
in Markdown; the HTML boilerplate and shared header/nav/footer live in one
layout. Folder structure maps to routes.

- `npm start` — live viewer at http://localhost:8080 with hot reload
- `npm run build` — generate the static site into `_site/`
- `npm run validate` — build, then check formatting (Prettier), lint CSS
  (stylelint) and HTML (html-validate)
- `npm run format` — format everything with Prettier

## Authoring

- Layout and page chrome live in [src/\_includes/base.njk](src/_includes/base.njk).
- Each page is a Markdown file with a `title` in front matter:

  ```md
  ---
  title: My page
  ---

  # My page

  Content here.
  ```

- Add a post at `src/posts/<year>/<slug>/index.md`, then add a matching
  `<li>` to the posts list in [src/index.md](src/index.md). Star a favourite
  with `<span class="star" role="img" aria-label="Favourite">★</span>`.

## TODO

- [ ] style
- [ ] intro blurb
- [ ] intro image

### pointless.click URLs to repair

- https://cancel.pointless.click/ ([src/posts/2021/cancel/index.md](src/posts/2021/cancel/index.md))
- https://arcade.pointless.click/ ([src/posts/2023/arcade/index.md](src/posts/2023/arcade/index.md))
- https://microwave.pointless.click ([src/posts/2023/microwave/index.md](src/posts/2023/microwave/index.md))
- https://physics.pointless.click ([src/posts/2024/brownian/index.md](src/posts/2024/brownian/index.md))
- https://googly.pointless.click ([src/posts/2024/googly/index.md](src/posts/2024/googly/index.md))
- https://rubik.pointless.click ([src/posts/2024/rubik/index.md](src/posts/2024/rubik/index.md))
