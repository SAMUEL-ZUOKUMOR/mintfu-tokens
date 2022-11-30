import { initializeKeypair } from "./initializeKeypair"
import * as web3 from "@solana/web3.js"
import * as token from "@solana/spl-token"
import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
  toMetaplexFile,
} from "@metaplex-foundation/js"
import {
  DataV2,
  createCreateMetadataAccountV2Instruction,
  createUpdateMetadataAccountV2Instruction,
} from "@metaplex-foundation/mpl-token-metadata"
import * as fs from "fs"

//create new mint
async function createNewMint(
    connection: web3.Connection,
    payer: web3.Keypair,
    mintAuthority: web3.PublicKey,
    freezeAuthority: web3.PublicKey,
    decimals: number
): Promise<web3.PublicKey> {

    const tokenMint = await token.createMint(
        connection,
        payer,
        mintAuthority,
        freezeAuthority,
        decimals
    );

    console.log(`The token mint account address is ${tokenMint}`)
    console.log(
        `Token Mint: https://explorer.solana.com/address/${tokenMint}?cluster=devnet`
    );

    return tokenMint;
}

//create a token account
async function createTokenAccount(
    connection: web3.Connection,
    payer: web3.Keypair,
    mint: web3.PublicKey,
    owner: web3.PublicKey
) {
    const tokenAccount = await token.getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        owner
    )
    
    console.log(
        `Token Account: https://explorer.solana.com/address/${tokenAccount.address}?cluster=devnet`
    )

    return tokenAccount
}

//create token metadata function
async function createTokenMetadata(
	connection: web3.Connection,
	metaplex: Metaplex,
	mint: web3.PublicKey,
	user: web3.Keypair,
	name: string,
	symbol: string,
	description: string,
){
	//file to buffer
	const buffer = fs.readFileSync("assets/mintfu.png");
	
	//file to metaplex file
	const file = toMetaplexFile(buffer, "mintfu.png");
	
	//upload the image and get image uri
	const imageUri = await metaplex.storage().upload(file)
	console.log("image uri:", imageUri);
	
	//upload metadata and get metadata uri (off-chain metadata)
	const { uri } = await metaplex.nfts().uploadMetadata({
		name: name,
		description: description,
		image: imageUri
	})
	
	console.log("metadata uri:", uri);
	
	//get metadata account address
	const metadataPDA = metaplex.nfts().pdas().metadata({mint});
	
	 // onchain metadata format
    const tokenMetadata = {
		name: name,
		symbol: symbol,
		uri: uri,
		sellerFeeBasisPoints: 0,
		creators: null,
		collection: null,
		uses: null,
	} as DataV2
	
	//transaction to create metadata account
	const transaction = new web3.Transaction().add(
		createCreateMetadataAccountV2Instruction(
        {
			metadata: metadataPDA,
			mint: mint,
			mintAuthority: user.publicKey,
			payer: user.publicKey,
			updateAuthority: user.publicKey,
        },
        {
			createMetadataAccountArgsV2: {
			data: tokenMetadata,
			isMutable: true,
			},
        }
		)
	)
	
	const transactionSignature = await web3.sendAndConfirmTransaction(connection, transaction, [user]);
	
	console.log(`Create Metadata Account: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`);
	
}

//function to update metadata account
async function updateTokenMetadata(
	connection: web3.Connection,
	metaplex: Metaplex,
	mint: web3.PublicKey,
	user: web3.Keypair,
	name: string,
	symbol: string,
	description: string
){

	// file to buffer
	const buffer = fs.readFileSync("assets/mintfu.png");
	
	//file to metaplex file
	const file = toMetaplexFile(buffer, "mintfu.png");
	
	//upload image and get imageUri
	const imageUri = await metaplex.storage().upload(file);
	
	//upload metadata and get metadata uri
	const { uri } = await metaplex.nfts().uploadMetadata({
		name: name,
		description: description,
		image: imageUri
	});
	
	console.log("metadata uri:", uri)
	
	const metadataPDA = await metaplex.nfts().pdas().metadata({mint});
	
	 // onchain metadata format
    const tokenMetadata = {
		name: name,
		symbol: symbol,
		uri: uri,
		sellerFeeBasisPoints: 0,
		creators: null,
		collection: null,
		uses: null,
	} as DataV2
	
	//transaction to update metadata
	const transaction = new web3.Transaction().add(
		createUpdateMetadataAccountV2Instruction(
		{
			metadata: metadataPDA,
			updateAuthority: user.publicKey,
		},
		{
			updateMetadataAccountArgsV2: {
			data: tokenMetadata,
			updateAuthority: user.publicKey,
			primarySaleHappened: true,
			isMutable: true,
			},
		}
		)
	)
	
	const transactionSignature = await web3.sendAndConfirmTransaction(connection, transaction, [user]);
	
	console.log(`Create Metadata Account: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`);
}

//function to minting tokens
async function mintTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  destination: web3.PublicKey,
  authority: web3.Keypair,
  amount: number
) {
  const mintInfo = await token.getMint(connection, mint)

  const transactionSignature = await token.mintTo(
    connection,
    payer,
    mint,
    destination,
    authority,
    amount * 10 ** mintInfo.decimals
  )

  console.log(
    `Mint Token Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}

//function for transfering tokens
async function transferTokens(
	connection: web3.Connection,
	payer: web3.Keypair,
	source: web3.PublicKey,
	destination: web3.PublicKey,
	owner: web3.PublicKey,
	amount: number,
	mint: web3.PublicKey
){
	
	const mintInfo = await token.getMint(connection, mint);
	
	const transactionSignature = await token.transfer(
		connection,
		payer,
		source,
		destination,
		owner,
		amount * 10 ** mintInfo.decimals
	);
	
	 console.log(
    `Transfer Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    );
}

async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  console.log("PublicKey:", user.publicKey.toBase58())
  
  const MINT_ADDRESS = "8s3T8AkbTuiTFPLSFwYU1kcBscxozQnpQS7FDK2tAGiM"
  
  //metaplex setup
  const metaplex = Metaplex.make(connection).use(keypairIdentity(user)).use(
	bundlrStorage({
		address: "https://devnet.bundlr.network",
        providerUrl: "https://api.devnet.solana.com",
        timeout: 60000
	})
  )
  
   await createTokenMetadata(
	connection,
	metaplex,
	new web3.PublicKey(MINT_ADDRESS),
	user,
	"mintfu",
	"MTF",
	"Grab the ninja mintfus to gain access to my ninja house party"
  )*/
  
  await updateTokenMetadata(
	connection,
	metaplex,
	new web3.PublicKey(MINT_ADDRESS),
	user,
	"mintfu",
	"MTF",
	"Grab the ninja mintfus to gain access to my ninja house party"
  )

  const mint = await createNewMint(
    connection,
    user,           // We'll pay the fees
    user.publicKey, // We're the mint authority
    user.publicKey, // And the freeze authority >:)
    2               // Only two decimals!
  )

  const tokenAccount = await createTokenAccount(
    connection,     
    user,           
    mint,            
    user.publicKey   // Associating our address with the token account
  )
  
  const receiver = web3.Keypair.generate().publicKey;
  
  const recipientTokenAccount = await token.getOrCreateAssociatedTokenAccount(
	connection,
	user,
	mint,
	new web3.PublicKey("9XZBXDSVt7Ym2a9UrsPMEQ6jeYDBkk2JsRhHvCJA6rF3")
  );
  
  // Mint 100 tokens to our address
  await mintTokens(connection, user, mint, tokenAccount.address, user, 100);
  await transferTokens(connection, user, tokenAccount.address, recipientTokenAccount.address, user.publicKey, 50, mint);
}

main()
  .then(() => {
    console.log("Finished successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
