---
title: Home
---

A few sentences of introduction. Below is a chronological list of posts.
Starred items are favourites (★).

## Posts

<ul class="posts">
  {%- for post in collections.posts %}
  {% include "post-item.njk" %}
  {%- endfor %}
</ul>
