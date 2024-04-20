<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

</script>

<template>
  <div style="width:100%;margin-top:150px;">
    <div style="width: fit-content;text-align: center;margin: auto;border-radius: 3px;border: 1px solid black;">
      <div style="padding: 10px 20px;">{{ router.currentRoute.value.path }}</div>
      <div style="background-color: black;color: white;padding: 2px 50px;">PAGE NOT FOUND 404</div>
    </div>
  </div>
</template>
