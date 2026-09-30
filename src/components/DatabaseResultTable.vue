<script setup lang="ts">
import type { QueryResult } from "../lib/types";
defineProps<{ result: QueryResult }>();
</script>

<template>
  <table>
    <thead>
      <tr>
        <th scope="col">#</th>
        <th v-for="(name, i) in result.columns" :key="i" scope="col">
          {{ name }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, index) in result.rows" :key="index">
        <th scope="row">{{ (result.offset || 0) + index + 1 }}</th>
        <td
          v-for="(value, i) in row"
          :key="i"
          :title="value === null ? 'NULL' : value"
        >
          <span v-if="value === null" class="db-null">NULL</span
          ><template v-else>{{ value }}</template>
        </td>
      </tr>
    </tbody>
  </table>
</template>
