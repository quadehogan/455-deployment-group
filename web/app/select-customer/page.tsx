import { listCustomers } from "@/lib/queries/shop";
import { SelectCustomerButtons } from "./select-customer-client";

export default async function SelectCustomerPage() {
  const customers = await listCustomers();

  return (
    <main className="page">
      <h1 className="page-heading">Select Customer</h1>
      <p className="text-muted-block">Select a customer to continue.</p>
      <SelectCustomerButtons customers={customers} />
    </main>
  );
}
