import { useResolve } from "@sportsdataverse/sdvplot/react";
import type { ReactElement } from "react";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "useResolve: ids for whatever the user typed",
  tags: ["react", "useResolve", "resolve", "nfl"],
} satisfies ExampleMeta;

const typed = ["KC", "Kansas City Chiefs", "OAK", "Las Vegas Raiders", "SD"];

function Resolved(): ReactElement | null {
  const resolve = useResolve("nfl"); // undefined until the league has loaded, then a sync resolver
  if (resolve === undefined) return null;
  return (
    <table>
      <thead>
        <tr>
          <th>typed</th>
          <th>team_id</th>
        </tr>
      </thead>
      <tbody>
        {typed.map((v) => (
          <tr key={v}>
            <td>{v}</td>
            <td>{resolve(v) ?? "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default <Resolved />;
