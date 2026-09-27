---
title: Posts
---

# Posts

<ul class="posts">
  {%- for post in collections.posts %}
  {% include "post-item.njk" %}
  {%- endfor %}
</ul>
